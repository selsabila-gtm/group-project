# routes/eval_runner.py
#
# This file is COPIED into the Docker container and executed there.
# It loads the user's model, runs it on the hidden test data, and prints the score.
#
# The container receives an optional columns_hint.json (same /eval dir) that
# tells it which columns the dataset has and which task type to use —
# so even competitions with non-standard schemas evaluate correctly.

import sys
import json
import pickle
import os


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_hint(eval_dir: str) -> dict:
    """Reads columns_hint.json if present. Returns {} on any failure."""
    hint_path = os.path.join(eval_dir, "columns_hint.json")
    try:
        with open(hint_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def load_model(model_path: str):
    try:
        with open(model_path, "rb") as f:
            return pickle.load(f)
    except Exception as e:
        print(f"ERROR loading model: {e}", file=sys.stderr)
        sys.exit(1)


def load_dataframe(test_data_path: str):
    ext = os.path.splitext(test_data_path)[1].lower()
    try:
        if ext == ".csv":
            import pandas as pd
            return pd.read_csv(test_data_path)
        elif ext in (".jsonl", ".json"):
            import pandas as pd
            return pd.read_json(test_data_path, lines=(ext == ".jsonl"))
        else:
            print(f"ERROR: unsupported test file format: {ext}", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"ERROR loading test data: {e}", file=sys.stderr)
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Task-specific evaluators
# Each function prints its metric line and returns (metric_name, score).
# ─────────────────────────────────────────────────────────────────────────────

def eval_classification(model, df, label_col: str, feature_cols: list[str]):
    from sklearn.metrics import accuracy_score, f1_score

    X      = df[feature_cols]
    y_true = df[label_col].astype(str)
    y_pred = [str(p) for p in model.predict(X)]

    acc = accuracy_score(y_true, y_pred)
    print(f"accuracy={acc:.4f}")
    return "accuracy", acc


def eval_text_pipeline(model, df, label_col: str):
    """
    For pipelines that accept raw text (e.g. TF-IDF + classifier).
    Tries text_content column first, then the first string column.
    """
    from sklearn.metrics import accuracy_score

    text_col = None
    if "text_content" in df.columns:
        text_col = "text_content"
    else:
        for col in df.columns:
            if col != label_col and df[col].dtype == object:
                text_col = col
                break

    if text_col is None:
        return eval_classification(
            model, df, label_col,
            [c for c in df.columns if c != label_col]
        )

    X      = df[text_col]
    y_true = df[label_col].astype(str)
    y_pred = [str(p) for p in model.predict(X)]

    acc = accuracy_score(y_true, y_pred)
    print(f"accuracy={acc:.4f}")
    return "accuracy", acc


def eval_question_answering(model, df):
    context_col  = "context"  if "context"  in df.columns else None
    question_col = "question" if "question" in df.columns else None
    answer_col   = "answer"   if "answer"   in df.columns else df.columns[-1]

    if context_col and question_col:
        X = df[[context_col, question_col]]
    elif question_col:
        X = df[[question_col]]
    else:
        X = df.iloc[:, :-1]

    preds   = model.predict(X)
    y_true  = df[answer_col].astype(str).str.strip()
    correct = sum(str(p).strip() == a for p, a in zip(preds, y_true))
    score   = correct / max(len(df), 1)
    print(f"exact_match={score:.4f}")
    return "exact_match", score


def eval_generic(model, df):
    """
    Last-resort evaluator.
    Tries every reasonable column combination until one doesn't crash.
    Prints accuracy vs the last column.
    """
    from sklearn.metrics import accuracy_score

    last_col = df.columns[-1]
    y_true   = df[last_col].astype(str)

    # Try numeric-only features first
    numeric_cols = [
        c for c in df.columns[:-1]
        if df[c].dtype in ("int64", "float64")
    ]
    candidates = [
        [c for c in df.columns if c != last_col],
        numeric_cols or [df.columns[0]],
    ]

    for feat_cols in candidates:
        try:
            y_pred = [str(p) for p in model.predict(df[feat_cols])]
            score  = accuracy_score(y_true, y_pred)
            print(f"accuracy={score:.4f}")
            return "accuracy", score
        except Exception:
            continue

    print("ERROR: could not run model.predict on any feature combination", file=sys.stderr)
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Main dispatch
# ─────────────────────────────────────────────────────────────────────────────

def evaluate(model_path: str, test_data_path: str, task_type: str):
    eval_dir = os.path.dirname(model_path)
    hint     = load_hint(eval_dir)

    # hint may override the task_type passed on CLI (organizer peeks at columns)
    if hint.get("task_type"):
        task_type = hint["task_type"]

    model = load_model(model_path)
    df    = load_dataframe(test_data_path)

    cols = list(df.columns)
    task = task_type.upper()

    # ── TEXT_CLASSIFICATION / SENTIMENT_ANALYSIS / NER ────────────────────
    if task in ("TEXT_CLASSIFICATION", "SENTIMENT_ANALYSIS", "NER"):
        # Determine label column
        label_col = None
        for candidate in ("label", "sentiment", "category", "class", "target"):
            if candidate in df.columns:
                label_col = candidate
                break
        if label_col is None:
            label_col = cols[-1]  # fall back to last column

        # Try text pipeline (model accepts raw strings)
        try:
            eval_text_pipeline(model, df, label_col)
            return
        except Exception:
            pass

        # Fall back to numeric features
        feature_cols = [c for c in cols if c != label_col and c != "text_content"]
        if not feature_cols:
            df["_text_len"] = df.get("text_content", df[cols[0]]).astype(str).str.len()
            feature_cols = ["_text_len"]

        eval_classification(model, df, label_col, feature_cols)

    # ── QUESTION_ANSWERING ─────────────────────────────────────────────────
    elif task == "QUESTION_ANSWERING":
        eval_question_answering(model, df)

    # ── TRANSLATION ────────────────────────────────────────────────────────
    elif task == "TRANSLATION":
        # BLEU score if sacrebleu available, else exact-match fallback
        ref_col  = None
        src_col  = "source" if "source" in cols else cols[0]
        for candidate in ("reference_translation", "target", "reference"):
            if candidate in cols:
                ref_col = candidate
                break
        if ref_col is None:
            ref_col = cols[-1]

        try:
            import sacrebleu
            preds = [str(p) for p in model.predict(df[[src_col]])]
            refs  = [df[ref_col].astype(str).tolist()]
            bleu  = sacrebleu.corpus_bleu(preds, refs).score / 100.0
            print(f"bleu={bleu:.4f}")
        except ImportError:
            # sacrebleu not installed → exact-match fallback
            preds   = [str(p).strip() for p in model.predict(df[[src_col]])]
            y_true  = df[ref_col].astype(str).str.strip()
            from sklearn.metrics import accuracy_score
            score   = accuracy_score(y_true, preds)
            print(f"accuracy={score:.4f}")

    # ── SUMMARIZATION ──────────────────────────────────────────────────────
    elif task == "SUMMARIZATION":
        doc_col = "document" if "document" in cols else cols[0]
        ref_col = "summary"  if "summary"  in cols else cols[-1]
        try:
            import rouge_score.rouge_scorer as rs
            scorer = rs.RougeScorer(["rougeL"], use_stemmer=True)
            preds  = [str(p) for p in model.predict(df[[doc_col]])]
            scores = [
                scorer.score(ref, pred)["rougeL"].fmeasure
                for ref, pred in zip(df[ref_col].astype(str), preds)
            ]
            rouge_l = sum(scores) / max(len(scores), 1)
            print(f"rouge_l={rouge_l:.4f}")
        except ImportError:
            # rouge_score not installed → exact-match fallback
            preds  = [str(p).strip() for p in model.predict(df[[doc_col]])]
            y_true = df[ref_col].astype(str).str.strip()
            from sklearn.metrics import accuracy_score
            score  = accuracy_score(y_true, preds)
            print(f"accuracy={score:.4f}")

    # ── GENERIC / UNKNOWN ──────────────────────────────────────────────────
    else:
        eval_generic(model, df)


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Called as: python eval_runner.py model.pkl test.csv TEXT_CLASSIFICATION
    if len(sys.argv) < 4:
        print(
            "Usage: eval_runner.py <model_path> <test_data_path> <task_type>",
            file=sys.stderr,
        )
        sys.exit(1)

    evaluate(sys.argv[1], sys.argv[2], sys.argv[3])
# routes/eval_runner.py
#
# Copied into the Docker/Kubernetes evaluation container and executed there.
# Loads the user's model, runs it on the hidden test data, prints the score.
#
# columns_hint.json (same /eval dir) tells it:
#   - which columns the dataset has
#   - which task type to use
#   - which metric the organizer chose (primary_metric)
#
# Metric priority:
#   1. organizer's primary_metric (from competition creation)
#   2. task_type default
#   3. generic fallback

import sys
import json
import pickle
import os


# ─────────────────────────────────────────────────────────────────────────────
# Metric registry
# Maps every metric name an organizer can pick → (function, higher_is_better)
# ─────────────────────────────────────────────────────────────────────────────

METRIC_REGISTRY = {
    # Classification / general
    "accuracy":     "higher",
    "f1":           "higher",
    "f1_macro":     "higher",
    "f1_weighted":  "higher",
    "precision":    "higher",
    "recall":       "higher",
    "auc":          "higher",
    "roc_auc":      "higher",
    # Regression
    "mse":          "lower",
    "mae":          "lower",
    "rmse":         "lower",
    "r2":           "higher",
    # NLP
    "exact_match":  "higher",
    "bleu":         "higher",
    "rouge_l":      "higher",
    "rouge_1":      "higher",
    "rouge_2":      "higher",
    "wer":          "lower",
    "cer":          "lower",
}

# Default metric per task type (used when organizer didn't specify one)
TASK_DEFAULT_METRIC = {
    "TEXT_CLASSIFICATION":  "accuracy",
    "SENTIMENT_ANALYSIS":   "accuracy",
    "NER":                  "f1",
    "QUESTION_ANSWERING":   "exact_match",
    "TRANSLATION":          "bleu",
    "SUMMARIZATION":        "rouge_l",
    "REGRESSION":           "rmse",
    "GENERIC":              "accuracy",
}


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


def resolve_metric(hint: dict, task_type: str) -> str:
    """
    Returns the metric name to compute, in priority order:
    1. organizer's primary_metric from hint
    2. task_type default
    3. accuracy
    """
    primary = (hint.get("primary_metric") or "").strip().lower()
    if primary and primary in METRIC_REGISTRY:
        return primary
    task_default = TASK_DEFAULT_METRIC.get(task_type.upper(), "accuracy")
    return task_default


# ─────────────────────────────────────────────────────────────────────────────
# Individual metric computers
# Each returns a float score. Caller prints it.
# ─────────────────────────────────────────────────────────────────────────────

def compute_accuracy(y_true, y_pred) -> float:
    from sklearn.metrics import accuracy_score
    return accuracy_score(
        [str(y) for y in y_true],
        [str(p) for p in y_pred],
    )


def compute_f1(y_true, y_pred, average="weighted") -> float:
    from sklearn.metrics import f1_score
    return f1_score(
        [str(y) for y in y_true],
        [str(p) for p in y_pred],
        average=average,
        zero_division=0,
    )


def compute_precision(y_true, y_pred) -> float:
    from sklearn.metrics import precision_score
    return precision_score(
        [str(y) for y in y_true],
        [str(p) for p in y_pred],
        average="weighted",
        zero_division=0,
    )


def compute_recall(y_true, y_pred) -> float:
    from sklearn.metrics import recall_score
    return recall_score(
        [str(y) for y in y_true],
        [str(p) for p in y_pred],
        average="weighted",
        zero_division=0,
    )


def compute_auc(y_true, y_pred_proba) -> float:
    from sklearn.metrics import roc_auc_score
    try:
        return roc_auc_score(y_true, y_pred_proba, multi_class="ovr")
    except Exception:
        return 0.0


def compute_mse(y_true, y_pred) -> float:
    from sklearn.metrics import mean_squared_error
    return mean_squared_error(
        [float(y) for y in y_true],
        [float(p) for p in y_pred],
    )


def compute_mae(y_true, y_pred) -> float:
    from sklearn.metrics import mean_absolute_error
    return mean_absolute_error(
        [float(y) for y in y_true],
        [float(p) for p in y_pred],
    )


def compute_rmse(y_true, y_pred) -> float:
    import math
    return math.sqrt(compute_mse(y_true, y_pred))


def compute_r2(y_true, y_pred) -> float:
    from sklearn.metrics import r2_score
    return r2_score(
        [float(y) for y in y_true],
        [float(p) for p in y_pred],
    )


def compute_exact_match(y_true, y_pred) -> float:
    correct = sum(
        str(t).strip() == str(p).strip()
        for t, p in zip(y_true, y_pred)
    )
    return correct / max(len(y_true), 1)


def compute_bleu(y_true, y_pred) -> float:
    try:
        import sacrebleu
        refs  = [[str(t) for t in y_true]]
        hyps  = [str(p) for p in y_pred]
        return sacrebleu.corpus_bleu(hyps, refs).score / 100.0
    except ImportError:
        # Fall back to rough token overlap if sacrebleu not available
        scores = []
        for ref, hyp in zip(y_true, y_pred):
            ref_tokens = set(str(ref).lower().split())
            hyp_tokens = str(hyp).lower().split()
            if not hyp_tokens:
                scores.append(0.0)
                continue
            overlap = sum(1 for t in hyp_tokens if t in ref_tokens)
            scores.append(overlap / len(hyp_tokens))
        return sum(scores) / max(len(scores), 1)


def compute_rouge_l(y_true, y_pred) -> float:
    try:
        import rouge_score.rouge_scorer as rs
        scorer = rs.RougeScorer(["rougeL"], use_stemmer=True)
        scores = [
            scorer.score(str(ref), str(pred))["rougeL"].fmeasure
            for ref, pred in zip(y_true, y_pred)
        ]
        return sum(scores) / max(len(scores), 1)
    except ImportError:
        return compute_exact_match(y_true, y_pred)


def compute_rouge_1(y_true, y_pred) -> float:
    try:
        import rouge_score.rouge_scorer as rs
        scorer = rs.RougeScorer(["rouge1"], use_stemmer=True)
        scores = [
            scorer.score(str(ref), str(pred))["rouge1"].fmeasure
            for ref, pred in zip(y_true, y_pred)
        ]
        return sum(scores) / max(len(scores), 1)
    except ImportError:
        return compute_exact_match(y_true, y_pred)


def compute_rouge_2(y_true, y_pred) -> float:
    try:
        import rouge_score.rouge_scorer as rs
        scorer = rs.RougeScorer(["rouge2"], use_stemmer=True)
        scores = [
            scorer.score(str(ref), str(pred))["rouge2"].fmeasure
            for ref, pred in zip(y_true, y_pred)
        ]
        return sum(scores) / max(len(scores), 1)
    except ImportError:
        return compute_exact_match(y_true, y_pred)


def compute_wer(y_true, y_pred) -> float:
    """Word Error Rate (lower is better)."""
    try:
        import jiwer
        return jiwer.wer(
            [str(t) for t in y_true],
            [str(p) for p in y_pred],
        )
    except ImportError:
        # Manual WER
        total_words, total_errors = 0, 0
        for ref, hyp in zip(y_true, y_pred):
            r = str(ref).split()
            h = str(hyp).split()
            total_words += len(r)
            # Levenshtein on word level
            d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
            for i in range(len(r) + 1):
                d[i][0] = i
            for j in range(len(h) + 1):
                d[0][j] = j
            for i in range(1, len(r) + 1):
                for j in range(1, len(h) + 1):
                    cost = 0 if r[i - 1] == h[j - 1] else 1
                    d[i][j] = min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost)
            total_errors += d[len(r)][len(h)]
        return total_errors / max(total_words, 1)


# Map metric name → compute function
METRIC_FUNCTIONS = {
    "accuracy":    compute_accuracy,
    "f1":          lambda yt, yp: compute_f1(yt, yp, "weighted"),
    "f1_macro":    lambda yt, yp: compute_f1(yt, yp, "macro"),
    "f1_weighted": lambda yt, yp: compute_f1(yt, yp, "weighted"),
    "precision":   compute_precision,
    "recall":      compute_recall,
    "mse":         compute_mse,
    "mae":         compute_mae,
    "rmse":        compute_rmse,
    "r2":          compute_r2,
    "exact_match": compute_exact_match,
    "bleu":        compute_bleu,
    "rouge_l":     compute_rouge_l,
    "rouge_1":     compute_rouge_1,
    "rouge_2":     compute_rouge_2,
    "wer":         compute_wer,
    # auc / roc_auc need predict_proba — handled specially in evaluate()
}


# ─────────────────────────────────────────────────────────────────────────────
# Feature extraction helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_label_col(df, hint: dict) -> str:
    """Find the label/target column."""
    hint_label = hint.get("label_col")
    if hint_label and hint_label in df.columns:
        return hint_label
    for c in ("label", "sentiment", "category", "class", "target", "answer"):
        if c in df.columns:
            return c
    return df.columns[-1]


def get_text_col(df, label_col: str) -> str | None:
    """Find the raw text column, if any."""
    for c in ("text_content", "text", "review", "sentence", "document", "source", "question"):
        if c in df.columns and c != label_col:
            return c
    # Fall back to first object column that isn't the label
    for c in df.columns:
        if c != label_col and df[c].dtype == object:
            return c
    return None


def get_feature_cols(df, label_col: str) -> list[str]:
    return [c for c in df.columns if c != label_col]


# ─────────────────────────────────────────────────────────────────────────────
# Prediction dispatch — handles text pipelines vs tabular feature models
# ─────────────────────────────────────────────────────────────────────────────

def get_predictions(model, df, task: str, hint: dict):
    """
    Returns (y_true, y_pred) as lists of strings/floats depending on metric type.
    Tries the smartest input shape for each task first.
    """
    label_col   = get_label_col(df, hint)
    text_col    = get_text_col(df, label_col)
    feature_cols = get_feature_cols(df, label_col)
    y_true      = df[label_col].tolist()

    # Tasks with special multi-column inputs
    if task == "QUESTION_ANSWERING":
        context_col  = "context"  if "context"  in df.columns else None
        question_col = "question" if "question" in df.columns else None
        if context_col and question_col:
            X = df[[context_col, question_col]]
        elif question_col:
            X = df[[question_col]]
        else:
            X = df[feature_cols]
        return y_true, model.predict(X)

    if task in ("TRANSLATION", "SUMMARIZATION"):
        src_col = "source" if "source" in df.columns else ("document" if "document" in df.columns else df.columns[0])
        return y_true, model.predict(df[[src_col]])

    # For all other tasks: try text pipeline first, then tabular
    if text_col:
        try:
            preds = model.predict(df[text_col])
            return y_true, preds
        except Exception:
            pass

    # Try full feature set
    try:
        preds = model.predict(df[feature_cols])
        return y_true, preds
    except Exception:
        pass

    # Last resort: numeric-only columns
    numeric_cols = [c for c in feature_cols if df[c].dtype in ("int64", "float64")]
    if numeric_cols:
        preds = model.predict(df[numeric_cols])
        return y_true, preds

    print("ERROR: could not call model.predict on any feature combination", file=sys.stderr)
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Main evaluate function
# ─────────────────────────────────────────────────────────────────────────────

def evaluate(model_path: str, test_data_path: str, task_type: str):
    eval_dir = os.path.dirname(model_path)
    hint     = load_hint(eval_dir)

    # Hint overrides CLI task_type (organizer knows best)
    if hint.get("task_type"):
        task_type = hint["task_type"]

    # ── Determine which metric to compute ─────────────────────────────────────
    metric_name = resolve_metric(hint, task_type)
    task        = task_type.upper()

    model = load_model(model_path)
    df    = load_dataframe(test_data_path)

    y_true, y_pred = get_predictions(model, df, task, hint)

    # ── AUC / ROC-AUC need predict_proba ─────────────────────────────────────
    if metric_name in ("auc", "roc_auc"):
        try:
            y_scores = model.predict_proba(df[get_feature_cols(df, get_label_col(df, hint))])
            score    = compute_auc(y_true, y_scores)
        except Exception:
            # Fall back to accuracy if model doesn't support predict_proba
            metric_name = "accuracy"
            score = compute_accuracy(y_true, y_pred)
    else:
        compute_fn = METRIC_FUNCTIONS.get(metric_name)
        if compute_fn is None:
            # Unknown metric — default to accuracy
            metric_name = "accuracy"
            compute_fn  = compute_accuracy

        try:
            score = compute_fn(y_true, y_pred)
        except Exception as e:
            print(f"ERROR computing {metric_name}: {e}", file=sys.stderr)
            # Try accuracy as absolute last resort
            try:
                score = compute_accuracy(y_true, y_pred)
                metric_name = "accuracy"
            except Exception:
                sys.exit(1)

    print(f"{metric_name}={score:.4f}")


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
# routes/eval_runner.py
#
# Copied into the Docker/Kubernetes evaluation container and executed there.
# Loads the user's model, runs it on the hidden test data, prints the score.
#
# columns_hint.json (same /eval dir) tells it:
#   - which columns the dataset has
#   - which task type to use
#   - which metric the organizer chose (primary_metric)
#   - optional: label_col override
#
# Metric priority:
#   1. organizer's primary_metric (from competition creation)
#   2. task_type default
#   3. generic fallback (accuracy)
#
# Supported task types:
#   TEXT_CLASSIFICATION, SENTIMENT_ANALYSIS, NER, QUESTION_ANSWERING,
#   TRANSLATION, SUMMARIZATION, REGRESSION, AUDIO_SYNTHESIS, GENERIC
#
# Supported metrics:
#   accuracy, f1, f1_macro, f1_weighted, precision, recall,
#   auc, roc_auc, mse, mae, rmse, r2,
#   exact_match, bleu, rouge_l, rouge_1, rouge_2, wer, cer

import sys
import json
import pickle
import os


# ─────────────────────────────────────────────────────────────────────────────
# Metric registry
# Maps every metric name an organizer can pick → direction
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
    # FIX: AUDIO_SYNTHESIS uses WER (transcript quality)
    "AUDIO_SYNTHESIS":      "wer",
    "TEXT_PROCESSING":      "accuracy",
    "COGNITIVE_LOGIC":      "exact_match",
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
        elif ext in (".jsonl",):
            import pandas as pd
            return pd.read_json(test_data_path, lines=True)
        elif ext == ".json":
            import pandas as pd
            # Try lines=True first (JSONL), fall back to normal JSON
            try:
                return pd.read_json(test_data_path, lines=True)
            except Exception:
                return pd.read_json(test_data_path)
        elif ext in (".tsv",):
            import pandas as pd
            return pd.read_csv(test_data_path, sep="\t")
        else:
            # Unknown extension — try CSV first, then JSON
            import pandas as pd
            try:
                return pd.read_csv(test_data_path)
            except Exception:
                try:
                    return pd.read_json(test_data_path, lines=True)
                except Exception:
                    print(f"ERROR: unsupported test file format: {ext}", file=sys.stderr)
                    sys.exit(1)
    except Exception as e:
        print(f"ERROR loading test data: {e}", file=sys.stderr)
        sys.exit(1)


# Translates the exact strings stored by the frontend dropdown → internal key.
# The organizer picks from: Accuracy, F1 Score, BLEU, ROUGE-L, WER, Exact Match
METRIC_NAME_MAP = {
    "accuracy":    "accuracy",
    "f1 score":    "f1",
    "f1":          "f1",
    "bleu":        "bleu",
    "rouge-l":     "rouge_l",
    "rouge_l":     "rouge_l",
    "wer":         "wer",
    "exact match": "exact_match",
    "exact_match": "exact_match",
}


def normalize_metric(raw: str) -> str | None:
    """
    Convert whatever the frontend stored (e.g. 'F1 Score', 'ROUGE-L')
    to the internal key used in METRIC_REGISTRY (e.g. 'f1', 'rouge_l').
    Returns None if the value is not one of the 6 allowed metrics.
    """
    return METRIC_NAME_MAP.get(raw.strip().lower())


def resolve_metric(hint: dict, task_type: str) -> str:
    """
    Returns the metric name to compute, in priority order:
    1. organizer's primary_metric from hint (normalized from frontend string)
    2. task_type default
    3. accuracy
    """
    raw_primary = (hint.get("primary_metric") or "").strip()
    if raw_primary:
        normalized = normalize_metric(raw_primary)
        if normalized:
            return normalized
    task_upper = task_type.upper().replace(" ", "_")
    return TASK_DEFAULT_METRIC.get(task_upper, "accuracy")


# ─────────────────────────────────────────────────────────────────────────────
# Individual metric computers
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
        return roc_auc_score(y_true, y_pred_proba, multi_class="ovr", average="macro")
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
        str(t).strip().lower() == str(p).strip().lower()
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
        # Fallback: rough 1-gram precision
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


def _rouge_scores(y_true, y_pred, rouge_type: str) -> float:
    try:
        import rouge_score.rouge_scorer as rs
        scorer = rs.RougeScorer([rouge_type], use_stemmer=True)
        scores = [
            scorer.score(str(ref), str(pred))[rouge_type].fmeasure
            for ref, pred in zip(y_true, y_pred)
        ]
        return sum(scores) / max(len(scores), 1)
    except ImportError:
        return compute_exact_match(y_true, y_pred)


def compute_rouge_l(y_true, y_pred) -> float:
    return _rouge_scores(y_true, y_pred, "rougeL")


def compute_rouge_1(y_true, y_pred) -> float:
    return _rouge_scores(y_true, y_pred, "rouge1")


def compute_rouge_2(y_true, y_pred) -> float:
    return _rouge_scores(y_true, y_pred, "rouge2")


def _levenshtein_word(r: list, h: list) -> int:
    """Word-level edit distance."""
    d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        d[i][0] = i
    for j in range(len(h) + 1):
        d[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            d[i][j] = min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost)
    return d[len(r)][len(h)]


def _levenshtein_char(r: str, h: str) -> int:
    """Character-level edit distance."""
    d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        d[i][0] = i
    for j in range(len(h) + 1):
        d[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            d[i][j] = min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + cost)
    return d[len(r)][len(h)]


def compute_wer(y_true, y_pred) -> float:
    """Word Error Rate (lower is better)."""
    try:
        import jiwer
        return jiwer.wer(
            [str(t) for t in y_true],
            [str(p) for p in y_pred],
        )
    except ImportError:
        total_words, total_errors = 0, 0
        for ref, hyp in zip(y_true, y_pred):
            r = str(ref).split()
            h = str(hyp).split()
            total_words += max(len(r), 1)
            total_errors += _levenshtein_word(r, h)
        return total_errors / max(total_words, 1)


def compute_cer(y_true, y_pred) -> float:
    """
    Character Error Rate (lower is better).
    FIX: was missing from original eval_runner — added here.
    """
    try:
        import jiwer
        # jiwer >= 2.6 supports CER
        return jiwer.cer(
            [str(t) for t in y_true],
            [str(p) for p in y_pred],
        )
    except (ImportError, AttributeError):
        # Manual CER via character-level Levenshtein
        total_chars, total_errors = 0, 0
        for ref, hyp in zip(y_true, y_pred):
            r = str(ref)
            h = str(hyp)
            total_chars += max(len(r), 1)
            total_errors += _levenshtein_char(r, h)
        return total_errors / max(total_chars, 1)


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
    "cer":         compute_cer,   # FIX: was missing
    # auc / roc_auc need predict_proba — handled specially in evaluate()
}


# ─────────────────────────────────────────────────────────────────────────────
# Feature extraction helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_label_col(df, hint: dict) -> str:
    """Find the label/target column."""
    # Organizer can explicitly specify the label column in the hint
    hint_label = hint.get("label_col")
    if hint_label and hint_label in df.columns:
        return hint_label
    for c in ("label", "sentiment", "category", "class", "target", "answer",
              "translation", "summary", "transcript"):
        if c in df.columns:
            return c
    # Last resort: last column
    return df.columns[-1]


def get_text_col(df, label_col: str) -> str | None:
    """Find the raw text / source column, if any."""
    for c in ("text_content", "text", "review", "sentence", "document",
              "source", "question", "context", "input"):
        if c in df.columns and c != label_col:
            return c
    # Fall back to first object column that isn't the label
    for c in df.columns:
        if c != label_col and df[c].dtype == object:
            return c
    return None


def get_feature_cols(df, label_col: str) -> list:
    return [c for c in df.columns if c != label_col]


# ─────────────────────────────────────────────────────────────────────────────
# Prediction dispatch
# ─────────────────────────────────────────────────────────────────────────────

def get_predictions(model, df, task: str, hint: dict):
    """
    Returns (y_true, y_pred).
    Tries the most natural input shape for each task first, falls back gracefully.
    """
    label_col    = get_label_col(df, hint)
    text_col     = get_text_col(df, label_col)
    feature_cols = get_feature_cols(df, label_col)
    y_true       = df[label_col].tolist()

    task_upper = task.upper().replace(" ", "_")

    # ── Task-specific input routing ───────────────────────────────────────────
    if task_upper == "QUESTION_ANSWERING" or task_upper == "COGNITIVE_LOGIC":
        context_col  = "context"  if "context"  in df.columns else None
        question_col = "question" if "question" in df.columns else None
        if context_col and question_col:
            X = df[[context_col, question_col]]
        elif question_col:
            X = df[[question_col]]
        elif text_col:
            X = df[[text_col]]
        else:
            X = df[feature_cols]
        return y_true, _safe_predict(model, X, df, label_col)

    if task_upper in ("TRANSLATION",):
        src_col = next(
            (c for c in ("source", "src", "text_content", "text") if c in df.columns),
            df.columns[0]
        )
        return y_true, _safe_predict(model, df[[src_col]], df, label_col)

    if task_upper in ("SUMMARIZATION",):
        doc_col = next(
            (c for c in ("document", "article", "text_content", "text", "source") if c in df.columns),
            df.columns[0]
        )
        return y_true, _safe_predict(model, df[[doc_col]], df, label_col)

    if task_upper in ("AUDIO_SYNTHESIS",):
        # Audio task: model predicts transcript from audio features or path
        audio_col = next(
            (c for c in ("audio_path", "audio_url", "audio_features", "features", "mfcc") if c in df.columns),
            None
        )
        if audio_col:
            return y_true, _safe_predict(model, df[[audio_col]], df, label_col)
        # Fall through to generic

    # ── Generic: try text pipeline → full features → numeric only ─────────────
    if text_col:
        try:
            preds = model.predict(df[text_col])
            return y_true, list(preds)
        except Exception:
            pass

    # Try all feature columns
    try:
        preds = model.predict(df[feature_cols])
        return y_true, list(preds)
    except Exception:
        pass

    # Last resort: numeric-only columns
    numeric_cols = [c for c in feature_cols if df[c].dtype in ("int64", "float64", "float32")]
    if numeric_cols:
        try:
            preds = model.predict(df[numeric_cols])
            return y_true, list(preds)
        except Exception:
            pass

    print("ERROR: could not call model.predict on any feature combination", file=sys.stderr)
    sys.exit(1)


def _safe_predict(model, X, df, label_col):
    """Try predict; on failure fall back to all features then numeric."""
    try:
        return list(model.predict(X))
    except Exception:
        feature_cols = [c for c in df.columns if c != label_col]
        try:
            return list(model.predict(df[feature_cols]))
        except Exception:
            numeric_cols = [c for c in feature_cols if df[c].dtype in ("int64", "float64", "float32")]
            return list(model.predict(df[numeric_cols]))


# ─────────────────────────────────────────────────────────────────────────────
# Main evaluate function
# ─────────────────────────────────────────────────────────────────────────────

def evaluate(model_path: str, test_data_path: str, task_type: str):
    eval_dir = os.path.dirname(model_path)
    hint     = load_hint(eval_dir)

    # Hint's task_type overrides CLI arg (organizer's configuration wins)
    if hint.get("task_type"):
        task_type = hint["task_type"]

    task_type_norm = task_type.upper().replace(" ", "_")

    # ── Determine which metric to compute ────────────────────────────────────
    metric_name = resolve_metric(hint, task_type_norm)

    model = load_model(model_path)
    df    = load_dataframe(test_data_path)

    if df.empty:
        print("ERROR: test dataset is empty", file=sys.stderr)
        sys.exit(1)

    if len(df.columns) < 2:
        print("ERROR: test dataset must have at least 2 columns (features + label)", file=sys.stderr)
        sys.exit(1)

    y_true, y_pred = get_predictions(model, df, task_type_norm, hint)

    print("\n===== EVALUATION DEBUG =====")

    for i in range(min(10, len(y_true))):
       print(f"\nSample {i+1}")
       print("TRUE :", y_true[i])
       print("PRED :", y_pred[i])
 
    print("\n============================")

    if not y_true or not y_pred:
        print("ERROR: prediction arrays are empty", file=sys.stderr)
        sys.exit(1)

    if len(y_true) != len(y_pred):
        print(
            f"ERROR: length mismatch — y_true={len(y_true)}, y_pred={len(y_pred)}",
            file=sys.stderr,
        )
        sys.exit(1)

    # ── AUC / ROC-AUC need predict_proba ────────────────────────────────────
    if metric_name in ("auc", "roc_auc"):
        try:
            label_col    = get_label_col(df, hint)
            feature_cols = get_feature_cols(df, label_col)
            y_scores = model.predict_proba(df[feature_cols])
            score    = compute_auc(y_true, y_scores)
        except Exception:
            # Fall back to accuracy if model doesn't support predict_proba
            metric_name = "accuracy"
            score = compute_accuracy(y_true, y_pred)
    else:
        compute_fn = METRIC_FUNCTIONS.get(metric_name)
        if compute_fn is None:
            # Unknown metric — fall back to accuracy
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
            except Exception as e2:
                print(f"ERROR fallback accuracy also failed: {e2}", file=sys.stderr)
                sys.exit(1)

    # Output EXACTLY ONE line in the format the backend expects:  metric=value
    print(f"{metric_name}={score:.4f}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Called as: python eval_runner.py <model.pkl> <test.csv> <TASK_TYPE>
    if len(sys.argv) < 4:
        print(
            "Usage: eval_runner.py <model_path> <test_data_path> <task_type>",
            file=sys.stderr,
        )
        sys.exit(1)

    evaluate(sys.argv[1], sys.argv[2], sys.argv[3])
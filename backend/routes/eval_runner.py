# routes/eval_runner.py
# This file is COPIED into the Docker container and executed there.
# It loads the user's model, runs it on the hidden test data, and prints the score.

import sys
import json
import pickle
import os

def evaluate(model_path: str, test_data_path: str, task_type: str):
    """
    Loads the model from model_path, runs it on test_data_path,
    and prints the metric in the format: accuracy=0.91
    """
    try:
        # Load model
        with open(model_path, "rb") as f:
            model = pickle.load(f)
    except Exception as e:
        print(f"ERROR loading model: {e}", file=sys.stderr)
        sys.exit(1)

    # Load test data
    ext = os.path.splitext(test_data_path)[1].lower()

    try:
        if ext == ".csv":
            import pandas as pd
            df = pd.read_csv(test_data_path)
        elif ext == ".jsonl":
            import pandas as pd
            df = pd.read_json(test_data_path, lines=True)
        else:
            print(f"ERROR: unsupported test file format: {ext}", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"ERROR loading test data: {e}", file=sys.stderr)
        sys.exit(1)

    # Run evaluation based on task type
    try:
        if task_type in ("TEXT_CLASSIFICATION", "SENTIMENT_ANALYSIS", "NER"):
            from sklearn.metrics import f1_score, accuracy_score

            # The test file must have a column called "label" or "sentiment"
            label_col = "label" if "label" in df.columns else "sentiment"
            feature_cols = [c for c in df.columns if c != label_col and c != "text_content"]

            if not feature_cols:
                # If only text_content exists, use its length as a dummy feature
                df["text_len"] = df["text_content"].str.len()
                feature_cols = ["text_len"]

            X = df[feature_cols]
            y_true = df[label_col]
            y_pred = model.predict(X)

            score = accuracy_score(y_true, y_pred)
            print(f"accuracy={score:.4f}")

        elif task_type == "QUESTION_ANSWERING":
            # Simple exact-match score
            preds = model.predict(df[["context", "question"]] if "context" in df.columns else df.iloc[:, :-1])
            correct = sum(str(p).strip() == str(a).strip() for p, a in zip(preds, df["answer"]))
            score = correct / len(df)
            print(f"exact_match={score:.4f}")

        else:
            # Generic: just try predict and compute accuracy
            last_col = df.columns[-1]
            X = df.iloc[:, :-1]
            y_true = df[last_col]
            y_pred = model.predict(X)
            from sklearn.metrics import accuracy_score
            score = accuracy_score(y_true, y_pred)
            print(f"accuracy={score:.4f}")

    except Exception as e:
        print(f"ERROR during evaluation: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    # Called as: python eval_runner.py model.pkl test.csv TEXT_CLASSIFICATION
    if len(sys.argv) < 4:
        print("Usage: eval_runner.py <model_path> <test_data_path> <task_type>", file=sys.stderr)
        sys.exit(1)

    evaluate(sys.argv[1], sys.argv[2], sys.argv[3])
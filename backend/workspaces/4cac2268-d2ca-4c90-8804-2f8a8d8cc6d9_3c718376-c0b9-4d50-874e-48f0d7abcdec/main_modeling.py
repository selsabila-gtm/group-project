import pandas as pd
import pickle
from pathlib import Path

from sklearn.dummy import DummyClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

train_path = Path("/home/jovyan/work/data/train.csv")
test_path = Path("/home/jovyan/work/data/test.csv")

if train_path.exists() and test_path.exists():
    train_df = pd.read_csv(train_path)
    test_df = pd.read_csv(test_path)
    print("Loaded real dataset.")
else:
    print("Dataset files not found. Using a tiny demo dataset so model.pkl can be created.")

    train_df = pd.DataFrame({
        "text_content": [
            "medical abstract about heart disease",
            "clinical study about diabetes treatment",
            "machine learning model for diagnosis",
            "neural network improves text classification",
            "patient symptoms and hospital records",
            "algorithm predicts disease risk",
        ],
        "label": [
            "medical",
            "medical",
            "ml",
            "ml",
            "medical",
            "ml",
        ],
    })

    test_df = pd.DataFrame({
        "text_content": [
            "clinical diagnosis and patient symptoms",
            "machine learning classification algorithm",
        ],
        "label": [
            "medical",
            "ml",
        ],
    })

train_df["text_content"] = train_df["text_content"].fillna("").astype(str)
train_df["label"] = train_df["label"].fillna("").astype(str)

if train_df["label"].nunique() <= 1:
    print("Only one label found. Using DummyClassifier.")
    model = Pipeline([
        ("tfidf", TfidfVectorizer()),
        ("clf", DummyClassifier(strategy="most_frequent")),
    ])
else:
    model = Pipeline([
        ("tfidf", TfidfVectorizer()),
        ("clf", LogisticRegression(max_iter=1000)),
    ])

model.fit(train_df["text_content"], train_df["label"])

with open("model.pkl", "wb") as f:
    pickle.dump(model, f)

print("Model saved to model.pkl")
print("Train rows:", len(train_df))
print("Test rows:", len(test_df))

try:
    preds = model.predict(test_df["text_content"].fillna("").astype(str))
    print("Predictions:", list(preds))
except Exception as exc:
    print("Prediction test skipped:", exc)
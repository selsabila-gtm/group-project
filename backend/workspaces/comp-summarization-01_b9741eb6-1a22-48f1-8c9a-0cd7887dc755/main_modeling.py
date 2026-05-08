import pandas as pd
import pickle
import json
from sklearn.dummy import DummyClassifier

train_df = pd.read_csv("/home/jovyan/work/data/train.csv")

train_df["text_content"] = train_df["text_content"].fillna("").astype(str)
train_df["label"] = train_df["label"].fillna("").astype(str)

if train_df["label"].str.strip().eq("").all():
    def extract_summary(x):
        try:
            return json.loads(x).get("summary", "")
        except Exception:
            return ""

    train_df["label"] = train_df["annotation_json"].apply(extract_summary)

train_df = train_df[
    (train_df["text_content"].str.strip() != "") &
    (train_df["label"].str.strip() != "")
]

print("Train rows:", len(train_df))
print(train_df[["text_content", "label"]].head())

if len(train_df) == 0:
    raise ValueError("No usable training data.")

model = DummyClassifier(strategy="most_frequent")
model.fit(train_df["text_content"], train_df["label"])

with open("model.pkl", "wb") as f:
    pickle.dump(model, f)

print("Model saved to model.pkl")
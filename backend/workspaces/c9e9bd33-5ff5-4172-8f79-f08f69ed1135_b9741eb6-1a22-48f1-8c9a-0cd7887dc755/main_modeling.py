import pandas as pd
import pickle

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

# =========================
# LOAD DATA
# =========================

train_df = pd.read_csv("/home/jovyan/work/data/train.csv")

# =========================
# CLEAN DATA
# =========================

train_df["text_content"] = train_df["text_content"].fillna("").astype(str)
train_df["label"] = train_df["label"].fillna("").astype(str)

train_df = train_df[
    (train_df["text_content"].str.strip() != "") &
    (train_df["label"].str.strip() != "")
]

print("Train rows:", len(train_df))

# =========================
# PREPARE DATA
# =========================

X_train = train_df["text_content"]
y_train = train_df["label"]

# =========================
# BETTER MODEL
# =========================

model = Pipeline([
    ("tfidf", TfidfVectorizer(
        ngram_range=(1,2),
        stop_words="english"
    )),
    ("clf", MultinomialNB())
])

# =========================
# TRAIN
# =========================

model.fit(X_train, y_train)

print("Model trained successfully")

# =========================
# SAVE MODEL
# =========================

with open("model.pkl", "wb") as f:
    pickle.dump(model, f)

print("Model saved to model.pkl")

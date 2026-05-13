import pandas as pd
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, f1_score

# =========================
# LOAD DATA
# =========================

train_df = pd.read_csv('/home/jovyan/work/data/train.csv')

print(train_df.head())
print(train_df.shape)

# =========================
# PREPARE DATA
# =========================

X_train = train_df["text"]
y_train = train_df["label"]

# =========================
# BUILD MODEL
# =========================

model = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("clf", LogisticRegression(max_iter=1000))
])

# =========================
# TRAIN MODEL
# =========================

model.fit(X_train, y_train)

print("Model trained successfully.")

# =========================
# SAVE MODEL
# =========================

joblib.dump(
    model,
    "/home/jovyan/work/saved_models/sentiment_model.pkl"
)

print("Model saved successfully.")
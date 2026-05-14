import pandas as pd
import pickle

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression


# =========================
# Load datasets
# =========================

train_df = pd.read_csv('/home/jovyan/work/data/train.csv')
test_df  = pd.read_csv('/home/jovyan/work/data/test.csv')


# =========================
# Clean data
# =========================

train_df['text_content'] = train_df['text_content'].fillna('').astype(str)
train_df['label'] = train_df['label'].fillna('').astype(str)

test_df['text_content'] = test_df['text_content'].fillna('').astype(str)


# =========================
# Build sentiment model
# =========================

model = Pipeline([
    (
        'tfidf',
        TfidfVectorizer(
            lowercase=True,
            stop_words='english',
            ngram_range=(1, 2),
            max_features=5000
        )
    ),

    (
        'clf',
        LogisticRegression(
            max_iter=2000
        )
    )
])


# =========================
# Train model
# =========================

model.fit(
    train_df['text_content'],
    train_df['label']
)


# =========================
# Quick local test
# =========================

sample_predictions = model.predict(
    test_df['text_content'].head(5)
)

print("\nSample Predictions:")
for i, pred in enumerate(sample_predictions):
    print(f"Sample {i+1}: {pred}")


# =========================
# Save model
# =========================

with open('model.pkl', 'wb') as f:
    pickle.dump(model, f)

print('\nModel saved successfully as model.pkl')
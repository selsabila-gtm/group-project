import pandas as pd
import pickle

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score

# =========================
# LOAD DATA
# =========================

train_df = pd.read_csv('/home/jovyan/work/data/train.csv')
test_df = pd.read_csv('/home/jovyan/work/data/test.csv')

# =========================
# CLEAN DATA
# =========================

train_df['text_content'] = train_df['text_content'].fillna('').astype(str)
train_df['label'] = train_df['label'].fillna('').astype(str)

test_df['text_content'] = test_df['text_content'].fillna('').astype(str)
test_df['label'] = test_df['label'].fillna('').astype(str)

# =========================
# REMOVE EMPTY ROWS
# =========================

train_df = train_df[
    (train_df['text_content'].str.strip() != '') &
    (train_df['label'].str.strip() != '')
]

test_df = test_df[
    (test_df['text_content'].str.strip() != '') &
    (test_df['label'].str.strip() != '')
]

print("Train rows:", len(train_df))
print("Test rows:", len(test_df))

# =========================
# PREPARE DATA
# =========================

X_train = train_df['text_content']
y_train = train_df['label']

X_test = test_df['text_content']
y_test = test_df['label']

# =========================
# BUILD BETTER MODEL
# =========================

model = Pipeline([
    (
        'tfidf',
        TfidfVectorizer(
            lowercase=True,
            stop_words='english',
            ngram_range=(1, 2)
        )
    ),
    (
        'clf',
        MultinomialNB()
    )
])

# =========================
# TRAIN MODEL
# =========================

model.fit(X_train, y_train)

print("Model trained successfully")

# =========================
# TEST MODEL
# =========================

predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("\nPredictions:")
print(predictions)

print("\nAccuracy:", accuracy)

# =========================
# SAVE MODEL
# =========================

with open('model.pkl', 'wb') as f:
    pickle.dump(model, f)

print("\nModel saved to model.pkl")

import pandas as pd

# Load dataset
df = pd.read_csv('/home/jovyan/work/data/dataset.csv')
print(f"Dataset loaded: {df.shape}")
print(df[['text_content', 'label']].head())

# For Summarization: text_content = source doc, annotation_json has the summary
import json

summaries = []
for _, row in df.iterrows():
    ann = json.loads(row['annotation_json'])
    summary = ann.get('summary', '')
    summaries.append({'source': row['text_content'], 'summary': summary})

print(f"\nSamples with summaries: {len(summaries)}")
print(summaries[0] if summaries else "No summaries found")

# Dummy metric to test Save Experiment flow
print("accuracy: 1.00")
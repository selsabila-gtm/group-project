# ── Lexivia Workspace ─────────────────────────────
# Public dataset is available at:
#   /home/jovyan/work/data/dataset.csv
#
# Load it with:
#   import pandas as pd
#   df = pd.read_csv('/home/jovyan/work/data/dataset.csv')
#
# Your task:
#   Train a model and create predictions.csv
#
# predictions.csv MUST contain:
#   id,prediction
#
# Example:
#   output.to_csv('predictions.csv', index=False)
#
# Accuracy is computed automatically by the backend
# using hidden labels uploaded by the organizer.
# Hidden labels are NEVER visible inside Jupyter.
# ─────────────────────────────────────────────────

import pandas as pd

df = pd.read_csv('/home/jovyan/work/data/dataset.csv')
print(df.head())

# ── Lexivia Workspace ──────────────────────────────────────────
# Dataset is available at: /home/jovyan/work/data/dataset.csv
# Load it with:
#   import pandas as pd
#   df = pd.read_csv('/home/jovyan/work/data/dataset.csv')
#
# When your model is trained, print the metric like this so it
# gets auto-detected and pre-filled in the Save Experiment modal:
#   print('accuracy: 0.94')
# ─────────────────────────────────────────────────────────────

import pandas as pd

# Load dataset
df = pd.read_csv('/home/jovyan/work/data/dataset.csv')
print('Dataset loaded:', df.shape)
print(df.head())

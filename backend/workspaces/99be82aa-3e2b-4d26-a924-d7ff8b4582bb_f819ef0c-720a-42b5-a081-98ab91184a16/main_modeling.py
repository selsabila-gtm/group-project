import pandas as pd

train_df = pd.read_csv('/home/jovyan/work/data/train.csv')
test_df = pd.read_csv('/home/jovyan/work/data/test.csv')

print(train_df.head())
print(test_df.head())

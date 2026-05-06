import pandas as pd

df = pd.read_csv('/home/jovyan/work/data/dataset.csv')

output = pd.DataFrame({
    "id": df["id"],
    "prediction": df["label"]
})

output.to_csv("predictions.csv", index=False)

print("done")
y_true = [1, 0, 1, 1]
y_pred = [1, 0, 0, 1]

correct = sum(a == b for a, b in zip(y_true, y_pred))
accuracy = correct / len(y_true)

print("METRIC accuracy=" + str(accuracy))
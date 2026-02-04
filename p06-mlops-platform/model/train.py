"""Model training with MLflow experiment tracking."""
import mlflow
import mlflow.sklearn
from sklearn.datasets import load_iris
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
import numpy as np

def train_model(n_estimators=100, max_depth=5, test_size=0.2, random_state=42):
    mlflow.set_experiment("iris-classification")
    with mlflow.start_run():
        X, y = load_iris(return_X_y=True)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=random_state)
        mlflow.log_param("n_estimators", n_estimators)
        mlflow.log_param("max_depth", max_depth)
        mlflow.log_param("test_size", test_size)
        model = RandomForestClassifier(n_estimators=n_estimators, max_depth=max_depth, random_state=random_state)
        model.fit(X_train, y_train)
        predictions = model.predict(X_test)
        accuracy = accuracy_score(y_test, predictions)
        f1 = f1_score(y_test, predictions, average="weighted")
        mlflow.log_metric("accuracy", accuracy)
        mlflow.log_metric("f1_score", f1)
        mlflow.sklearn.log_model(model, "model")
        print(f"Accuracy: {accuracy:.4f}, F1: {f1:.4f}")
        return model

if __name__ == "__main__":
    train_model()

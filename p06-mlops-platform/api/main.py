"""FastAPI model serving endpoint."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import mlflow
import numpy as np
import os

app = FastAPI(title="ML Model API", version="1.0.0")

class PredictionRequest(BaseModel):
    features: list[list[float]]

class PredictionResponse(BaseModel):
    predictions: list[int]
    model_version: str

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    try:
        model_uri = os.getenv("MODEL_URI", "models:/iris-classifier/Production")
        model = mlflow.sklearn.load_model(model_uri)
        features = np.array(request.features)
        predictions = model.predict(features).tolist()
        return PredictionResponse(predictions=predictions, model_version="1.0.0")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

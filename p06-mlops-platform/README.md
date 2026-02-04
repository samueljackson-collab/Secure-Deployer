# P06: MLOps Platform

A production-grade MLOps platform featuring MLflow experiment tracking, model serving with FastAPI, and end-to-end testing with Playwright.

## Architecture

```
+-------------------+       +-------------------+       +-------------------+
|   Training        |       |   MLflow Tracking  |       |   Model Registry  |
|   Pipeline        +------>+   Server           +------>+   (Artifacts)     |
|   (scikit-learn)  |       |   (Experiments)    |       |                   |
+-------------------+       +-------------------+       +--------+----------+
                                                                 |
                                                                 v
+-------------------+       +-------------------+       +-------------------+
|   Playwright      |       |   FastAPI          |       |   Model Loader    |
|   E2E Tests       +------>+   Serving Layer    +------>+   (MLflow Models) |
|   (Browser + API) |       |   (/predict)       |       |                   |
+-------------------+       +-------------------+       +-------------------+
```

## Components

### MLflow Experiment Tracking

- Tracks hyperparameters, metrics, and model artifacts for every training run
- Supports experiment comparison and model versioning
- Iris classification pipeline using scikit-learn `RandomForestClassifier`
- Logs accuracy, F1 score, and serialized model artifacts per run

### Model Serving with FastAPI

- RESTful API exposing trained models via `/predict` endpoint
- Health check at `/health` for readiness and liveness probes
- Loads models dynamically from the MLflow Model Registry
- Input validation via Pydantic schemas (`PredictionRequest` / `PredictionResponse`)

### End-to-End Testing with Playwright

- Browser and API-level tests validating the full serving pipeline
- Verifies health endpoint availability and prediction correctness
- HTML test reports generated for CI artifact archival
- Configured with retries and Chromium-based project execution

## Project Structure

```
p06-mlops-platform/
├── api/
│   └── main.py                  # FastAPI model serving endpoint
├── model/
│   └── train.py                 # Scikit-learn training with MLflow tracking
├── tests/
│   └── example.spec.ts          # Playwright E2E test suite
├── docs/
│   ├── threat-model.md          # STRIDE threat model for ML pipeline
│   └── adr/
│       ├── 001-use-mlflow-for-tracking.md
│       └── 002-use-playwright-for-e2e-tests.md
├── .github/
│   └── workflows/
│       └── e2e-tests.yml        # CI pipeline for E2E testing
├── playwright.config.ts         # Playwright configuration
├── requirements.txt             # Python dependencies
├── CHANGELOG.md
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ (for Playwright)
- MLflow tracking server (local or remote)

### Installation

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Playwright and browsers
npm init -y
npm install @playwright/test
npx playwright install chromium
```

### Training a Model

```bash
# Start MLflow tracking server (optional, defaults to local ./mlruns)
mlflow server --host 0.0.0.0 --port 5000

# Run training
python model/train.py
```

### Serving the Model

```bash
# Set the model URI (adjust to your registered model)
export MODEL_URI="models:/iris-classifier/Production"

# Start the API server
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Running E2E Tests

```bash
# Start the API server in the background
uvicorn api.main:app --host 0.0.0.0 --port 8000 &

# Run Playwright tests
npx playwright test

# View HTML report
npx playwright show-report
```

## API Reference

### `GET /health`

Returns the health status of the API.

**Response:**
```json
{ "status": "healthy" }
```

### `POST /predict`

Runs inference on the loaded model.

**Request:**
```json
{
  "features": [[5.1, 3.5, 1.4, 0.2]]
}
```

**Response:**
```json
{
  "predictions": [0],
  "model_version": "1.0.0"
}
```

## CI/CD

The GitHub Actions workflow (`.github/workflows/e2e-tests.yml`) automates:

1. Python environment setup and dependency installation
2. API server startup in the background
3. Node.js setup and Playwright browser installation
4. E2E test execution with HTML report generation
5. Artifact upload of test reports for review

## License

MIT

# Event-Driven Serverless App

A production-ready, event-driven serverless application built on AWS Lambda, Amazon SQS, and Amazon DynamoDB. Deployed and managed via the AWS Serverless Application Model (SAM).

## Architecture

```
Client
  |
  v
API Gateway (REST)
  |
  v
Ingestion Lambda ──> SQS Queue ──> Processing Lambda ──> DynamoDB
                       |
                       v
                  Dead-Letter Queue (DLQ)
```

### Components

| Component | Purpose |
|---|---|
| **API Gateway** | HTTPS endpoint accepting event payloads via POST |
| **Ingestion Lambda** | Validates incoming payloads and publishes messages to SQS |
| **SQS Queue** | Durable message buffer decoupling ingestion from processing |
| **Dead-Letter Queue** | Captures messages that fail processing after max retries |
| **Processing Lambda** | Consumes SQS messages, applies business logic, persists to DynamoDB |
| **DynamoDB** | NoSQL data store for processed event records |

## Prerequisites

- Python 3.11+
- AWS CLI v2 configured with appropriate credentials
- AWS SAM CLI >= 1.100.0
- Docker (for local invocation and testing)

## Quick Start

### Deploy to AWS

```bash
# Build the application
sam build

# Deploy with guided prompts (first time)
sam deploy --guided

# Subsequent deployments
sam deploy
```

### Local Development

```bash
# Invoke the ingestion function locally
sam local invoke IngestionFunction -e events/sample_event.json

# Start the local API
sam local start-api

# Send a test request
curl -X POST http://127.0.0.1:3000/events \
  -H "Content-Type: application/json" \
  -d '{"source": "sensor-01", "type": "temperature", "payload": {"value": 22.5, "unit": "celsius"}}'
```

### Running Tests

```bash
# Install test dependencies
pip install -r tests/requirements.txt

# Run all tests
python -m pytest tests/ -v

# Run with coverage
python -m pytest tests/ --cov=src --cov-report=term-missing
```

## Project Structure

```
p11-event-driven-serverless-app/
├── README.md
├── CHANGELOG.md
├── template.yaml                 # SAM template
├── docs/
│   ├── threat-model.md
│   └── adr/
│       └── 001-use-asynchronous-serverless-pattern.md
├── src/
│   ├── ingestion_function/
│   │   └── app.py
│   └── processing_function/
│       └── app.py
└── tests/
    ├── test_ingestion.py
    └── test_processing.py
```

## Configuration

Environment variables used by the Lambda functions:

| Variable | Function | Description |
|---|---|---|
| `SQS_QUEUE_URL` | Ingestion | URL of the target SQS queue |
| `DYNAMODB_TABLE_NAME` | Processing | Name of the DynamoDB table |
| `LOG_LEVEL` | Both | Logging verbosity (default: `INFO`) |
| `POWERTOOLS_SERVICE_NAME` | Both | Service identifier for structured logs |

## Deployment Parameters

| Parameter | Default | Description |
|---|---|---|
| `Stage` | `dev` | Deployment stage (dev, staging, prod) |
| `LogLevel` | `INFO` | Lambda log level |
| `MessageRetentionPeriod` | `345600` | SQS message retention in seconds (4 days) |
| `MaxReceiveCount` | `3` | Max SQS receive attempts before DLQ |

## Monitoring and Observability

- **CloudWatch Logs**: Structured JSON logs from both Lambda functions
- **CloudWatch Metrics**: Lambda invocation count, error rate, duration, SQS queue depth
- **CloudWatch Alarms**: Recommended alarms for DLQ message count and Lambda error rate
- **X-Ray Tracing**: Enabled on both Lambda functions for distributed tracing

## Security

- All IAM policies follow least-privilege principles
- API Gateway uses throttling to prevent abuse
- Input validation on all incoming payloads
- DynamoDB encryption at rest enabled by default
- SQS server-side encryption enabled
- See [docs/threat-model.md](docs/threat-model.md) for the full STRIDE analysis

## License

MIT

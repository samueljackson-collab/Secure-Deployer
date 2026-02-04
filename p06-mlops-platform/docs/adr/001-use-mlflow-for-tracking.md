# ADR 001: Use MLflow for Experiment Tracking

## Status

Accepted

## Date

2025-01-10

## Context

Our ML training pipelines produce numerous experimental runs with varying hyperparameters, metrics, and model artifacts. Without a centralized tracking system, reproducing results, comparing experiments, and managing model versions becomes increasingly difficult. We need a solution that:

- Logs hyperparameters, metrics, and artifacts for every training run
- Supports model versioning and lifecycle stage management (Staging, Production)
- Integrates natively with scikit-learn and other popular ML frameworks
- Can be self-hosted to keep data within our infrastructure boundary
- Provides a UI for experiment comparison and visualization

### Options Considered

1. **MLflow** -- Open-source platform with tracking, model registry, and serving capabilities. Large community, native integrations with scikit-learn, PyTorch, TensorFlow.
2. **Weights & Biases (W&B)** -- SaaS-first experiment tracking with rich visualization. Requires data to leave our infrastructure unless self-hosted (enterprise tier).
3. **DVC (Data Version Control)** -- Git-based data and model versioning. Strong for data pipelines but lacks a built-in experiment tracking UI and model registry.
4. **Custom logging to a database** -- Full control, but significant engineering effort to build comparison UIs, artifact storage, and model lifecycle management.

## Decision

We will use **MLflow** as our experiment tracking and model registry platform.

## Rationale

- **Native framework integration**: `mlflow.sklearn.log_model()` provides zero-friction logging for our scikit-learn pipelines, with analogous support for other frameworks as we grow.
- **Self-hosted control**: MLflow can run entirely within our VPC, with the tracking server backed by PostgreSQL and artifacts stored in S3, satisfying data residency requirements.
- **Model registry**: Built-in model versioning with stage transitions (None -> Staging -> Production) supports our promotion workflow with approval gates.
- **Community and ecosystem**: MLflow is the most widely adopted open-source ML tracking tool, ensuring long-term support and a broad plugin ecosystem.
- **Cost**: Fully open-source with no per-seat licensing, unlike W&B enterprise.

## Consequences

### Positive

- Centralized experiment metadata enables reproducibility and team-wide experiment comparison
- Model registry provides a single source of truth for which model version is in Production
- Artifact store integration (S3) allows efficient storage and retrieval of serialized models
- Developers can use the MLflow UI to compare metrics across runs without custom tooling

### Negative

- Operational overhead of maintaining the MLflow tracking server (PostgreSQL backend, S3 bucket, server process)
- MLflow UI has limited customization compared to W&B dashboards
- Team members need to learn MLflow APIs and conventions

### Risks

- If the MLflow tracking server is unavailable, training runs will fail to log (mitigated by local fallback logging)
- Large artifact volumes may increase S3 storage costs over time (mitigated by lifecycle policies)

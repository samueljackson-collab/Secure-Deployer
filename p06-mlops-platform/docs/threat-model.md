# Threat Model: MLOps Platform

## Overview

This document applies the STRIDE threat modeling framework to the MLOps platform, covering the training pipeline, model registry, serving layer, and supporting infrastructure.

## System Boundaries

| Component              | Description                                      |
|------------------------|--------------------------------------------------|
| Training Pipeline      | Scikit-learn model training with MLflow logging   |
| MLflow Tracking Server | Experiment metadata, metrics, and artifact store  |
| Model Registry         | Versioned model storage and promotion stages      |
| FastAPI Serving Layer  | REST API loading models and returning predictions |
| CI/CD Pipeline         | GitHub Actions running E2E tests with Playwright  |

## STRIDE Analysis

### 1. Spoofing

| Threat | An attacker impersonates a legitimate user or service to submit training runs or access the model registry. |
|--------|-------------------------------------------------------------------------------------------------------------|
| Target | MLflow Tracking Server, FastAPI `/predict` endpoint |
| Impact | Unauthorized experiment logging, model retrieval, or prediction abuse |
| Mitigation | - Enforce authentication on the MLflow tracking server (e.g., HTTP basic auth or OAuth proxy) |
|            | - Require API keys or JWT tokens for the FastAPI serving layer |
|            | - Use service accounts with scoped credentials for CI/CD pipelines |

### 2. Tampering / Model Poisoning

| Threat | An attacker modifies training data, model artifacts, or hyperparameters to degrade model performance or introduce backdoors. |
|--------|------------------------------------------------------------------------------------------------------------------------------|
| Target | Training data sources, MLflow artifact store, model registry |
| Impact | Corrupted model producing incorrect or adversarial predictions in production |
| Mitigation | - Sign model artifacts with cryptographic hashes and verify before deployment |
|            | - Enforce write-access controls on the MLflow artifact store (S3 bucket policies, IAM roles) |
|            | - Implement data validation checks in the training pipeline before fitting |
|            | - Require human approval for model promotion to the Production stage |

### 3. Repudiation

| Threat | A user or pipeline modifies training configurations or promotes a model without an auditable trail. |
|--------|-----------------------------------------------------------------------------------------------------|
| Target | MLflow experiment runs, model stage transitions |
| Impact | Inability to trace who deployed a faulty model or changed training parameters |
| Mitigation | - Enable MLflow run tagging with user identity and CI job metadata |
|            | - Log all model stage transitions with timestamps and actor identity |
|            | - Integrate audit logging with a centralized SIEM or log aggregation service |

### 4. Information Disclosure / Data Exfiltration

| Threat | Sensitive training data or proprietary model weights are exposed to unauthorized parties. |
|--------|------------------------------------------------------------------------------------------|
| Target | Training datasets, MLflow artifact store, API response payloads |
| Impact | Leakage of PII in training data, intellectual property theft via model extraction |
| Mitigation | - Encrypt training data at rest (S3 SSE, EBS encryption) and in transit (TLS) |
|            | - Restrict network access to the MLflow server using security groups and VPC endpoints |
|            | - Rate-limit the `/predict` endpoint to prevent model extraction attacks |
|            | - Never log raw training data in MLflow parameters or artifacts |

### 5. Denial of Service

| Threat | An attacker overwhelms the serving endpoint or MLflow server, disrupting availability. |
|--------|----------------------------------------------------------------------------------------|
| Target | FastAPI `/predict` endpoint, MLflow Tracking Server |
| Impact | Prediction service downtime, inability to log or retrieve experiments |
| Mitigation | - Deploy the API behind a load balancer with request rate limiting |
|            | - Set resource limits (CPU, memory) on serving containers |
|            | - Use auto-scaling policies for the model serving fleet |
|            | - Cache frequently loaded models in-memory to reduce artifact store pressure |

### 6. Elevation of Privilege / Unauthorized Model Deployment

| Threat | A compromised CI runner or unprivileged user promotes a model to Production without proper review. |
|--------|-----------------------------------------------------------------------------------------------------|
| Target | Model registry promotion workflow, CI/CD pipeline credentials |
| Impact | Untested or malicious model deployed to production serving |
| Mitigation | - Require multi-party approval for Production stage transitions |
|            | - Scope CI/CD credentials to read-only on the model registry; use a separate privileged pipeline for promotion |
|            | - Implement automated validation gates (accuracy threshold, bias checks) before promotion |
|            | - Use OIDC-based short-lived credentials instead of long-lived secrets in CI runners |

## Risk Summary

| Threat Category            | Severity | Likelihood | Risk Level |
|----------------------------|----------|------------|------------|
| Spoofing                   | High     | Medium     | High       |
| Model Poisoning / Tampering| Critical | Medium     | Critical   |
| Repudiation                | Medium   | Medium     | Medium     |
| Data Exfiltration          | High     | Medium     | High       |
| Denial of Service          | Medium   | High       | Medium     |
| Unauthorized Deployment    | Critical | Low        | High       |

## Review Schedule

This threat model should be reviewed:

- Quarterly, or after significant architectural changes
- After any security incident involving ML pipeline components
- When new data sources or model types are introduced

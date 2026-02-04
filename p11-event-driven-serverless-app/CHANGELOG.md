# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-02-04

### Added

- Initial release of the event-driven serverless application.
- Ingestion Lambda function with input validation and structured logging.
- Processing Lambda function with idempotency checks and batch failure reporting.
- AWS SAM template with API Gateway, SQS, DLQ, and DynamoDB resources.
- Least-privilege IAM policies for all Lambda functions.
- Dead-letter queue for failed message processing.
- Unit tests for ingestion and processing functions.
- STRIDE-based threat model documentation.
- Architecture Decision Record for asynchronous serverless pattern.

### Security

- Input payload validation with size and schema enforcement.
- SQS server-side encryption enabled.
- DynamoDB encryption at rest enabled.
- API Gateway throttling configured.
- X-Ray tracing enabled for distributed observability.

# ADR-001: Use Asynchronous Serverless Pattern for Event Processing

## Status

Accepted

## Date

2026-02-04

## Context

We need to build an event ingestion and processing system that can handle variable throughput, scale automatically, and remain cost-efficient during low-traffic periods. The system must:

- Accept event payloads via an HTTP API.
- Process events reliably without data loss.
- Handle traffic spikes without manual intervention.
- Maintain low operational overhead.
- Support independent scaling of ingestion and processing.

We considered three architectural approaches:

1. **Synchronous request-response**: API Gateway invokes a single Lambda that validates, processes, and stores the event in one synchronous call.
2. **Asynchronous event-driven**: API Gateway invokes an ingestion Lambda that validates and enqueues, with a separate processing Lambda consuming from the queue.
3. **Container-based microservices**: ECS/Fargate services with an application-level message queue.

## Decision

We will use the **asynchronous event-driven serverless pattern** with the following pipeline:

```
API Gateway -> Ingestion Lambda -> SQS Queue -> Processing Lambda -> DynamoDB
```

A dead-letter queue (DLQ) captures messages that fail processing after a configurable number of retries.

## Rationale

### Advantages over Synchronous Pattern

- **Decoupled scaling**: Ingestion and processing scale independently. The SQS queue acts as a durable buffer, absorbing traffic spikes without backpressure on the API.
- **Faster API responses**: The ingestion function returns HTTP 202 (Accepted) immediately after enqueuing, reducing client-perceived latency from seconds to milliseconds.
- **Fault isolation**: A failure in the processing pipeline does not affect the ingestion API. Messages remain in the queue until successfully processed.
- **Retry semantics**: SQS provides built-in retry with configurable visibility timeout and max receive count, eliminating custom retry logic.
- **Dead-letter handling**: Failed messages are automatically routed to a DLQ for investigation without blocking the main queue.

### Advantages over Container-based Approach

- **Zero idle cost**: Lambda charges only for actual invocations. During low-traffic periods, costs approach zero.
- **No capacity planning**: No need to configure ECS task counts, CPU/memory, or auto-scaling policies.
- **Reduced operational overhead**: No container image management, cluster configuration, or service mesh setup.
- **Faster time to production**: SAM template provisions the entire stack declaratively.

### Trade-offs Accepted

- **Cold starts**: Lambda cold starts add latency to the first invocation after idle periods. Acceptable for this use case since processing is asynchronous.
- **Execution time limit**: Lambda has a 15-minute maximum execution time. Acceptable because individual event processing completes in under 10 seconds.
- **Vendor lock-in**: Deep integration with AWS services. Mitigated by keeping business logic in portable Python modules separate from AWS-specific handler code.
- **Debugging complexity**: Distributed tracing across multiple services is harder than a monolithic application. Mitigated by enabling AWS X-Ray and using structured logging with correlation IDs.

## Consequences

- All event processing must be designed for at-least-once delivery semantics (SQS standard queue). Processing logic must be idempotent.
- Monitoring must cover SQS queue depth, DLQ message count, Lambda error rates, and DynamoDB throttling.
- The team must understand AWS SAM for infrastructure management and be familiar with Lambda concurrency controls to prevent denial-of-wallet scenarios.
- Future migration to a synchronous pattern (if requirements change) would require re-architecting the pipeline.

## References

- [AWS Well-Architected Serverless Lens](https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html)
- [Amazon SQS Best Practices](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-best-practices.html)
- [Lambda Event Source Mapping for SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)

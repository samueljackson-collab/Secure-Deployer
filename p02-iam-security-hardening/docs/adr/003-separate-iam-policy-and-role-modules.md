# ADR-003: Separate IAM Policy and Role Modules

## Status

Accepted

## Date

2026-01-13

## Context

When designing Terraform modules for IAM, there are two broad architectural
approaches:

1. **Monolithic module** -- a single module that creates a role, its trust
   policy, inline policies, and managed policy attachments in one invocation.
2. **Decomposed modules** -- separate modules for policies and roles that can
   be composed together by the caller.

The monolithic approach is simpler for trivial use-cases but becomes unwieldy
when:

* The same policy must be shared across multiple roles.
* Policies have different lifecycle cadences from roles.
* Teams want to manage policies and roles with different ownership boundaries.

## Decision

We will maintain **two independent modules**:

| Module | Responsibility |
|--------|---------------|
| `modules/iam-policy` | Creates a customer-managed IAM policy from a list of statements. |
| `modules/iam-assumable-role` | Creates an IAM role with a trust policy and attaches one or more managed policy ARNs. |

The root module (`main.tf`) demonstrates how to compose them.

## Rationale

* **Single Responsibility Principle** -- each module does one thing well.
  Policies know nothing about roles; roles accept policy ARNs as inputs.
* **Reusability** -- a single policy module invocation can produce a policy
  that is attached to multiple roles.
* **Independent lifecycles** -- policies can be updated without modifying role
  trust relationships and vice versa.
* **Testability** -- each module can be validated in isolation with
  `terraform validate` and plan-level checks.
* **Organisational alignment** -- in larger organisations, the security team
  may own policy definitions while platform teams own role definitions.

## Consequences

### Positive

* Maximum flexibility for composing IAM configurations.
* Clear interface boundaries (policy ARN is the contract between modules).
* Easier code review -- changes to policies do not touch role modules.

### Negative

* Slightly more boilerplate when a simple one-role-one-policy use-case would
  suffice (mitigated by the root module example).
* Callers must wire outputs to inputs explicitly (standard Terraform pattern).

## Alternatives Considered

* **Monolithic IAM module** -- rejected due to the reusability and lifecycle
  concerns described above.
* **Inline policies only** -- rejected because inline policies cannot be
  shared, have lower size limits, and are harder to audit centrally.

## References

* [Terraform Module Composition](https://developer.hashicorp.com/terraform/language/modules/develop/composition)
* [AWS Managed vs Inline Policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_managed-vs-inline.html)

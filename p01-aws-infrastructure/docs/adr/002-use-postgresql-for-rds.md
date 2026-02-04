# ADR-002: Use PostgreSQL for RDS

## Status

Accepted

## Date

2025-01-15

## Context

The application requires a relational database for persistent storage with the following requirements:

- **ACID compliance**: Strong transactional guarantees for data integrity.
- **JSON support**: The application stores semi-structured data alongside relational data.
- **Scalability**: The database must handle growing data volumes and query complexity.
- **Operational maturity**: Managed service support, automated backups, and Multi-AZ failover.
- **Ecosystem**: Broad language and framework support, active community, and extensive tooling.

AWS RDS supports multiple database engines: MySQL, PostgreSQL, MariaDB, Oracle, and SQL Server. We needed to select the engine that best fits our technical and operational requirements.

## Decision

We will use **PostgreSQL** as the RDS database engine.

### Evaluation Criteria

| Criteria | PostgreSQL | MySQL | MariaDB |
|----------|-----------|-------|---------|
| ACID compliance | Full | Full (InnoDB) | Full (InnoDB) |
| Native JSON support | `jsonb` with indexing | JSON type (limited indexing) | JSON type (limited indexing) |
| Advanced indexing | GiST, GIN, BRIN, partial indexes | B-tree, hash, full-text | B-tree, hash, full-text |
| Window functions | Full support | Full support (8.0+) | Full support |
| CTEs and recursive queries | Full support | Full support (8.0+) | Full support |
| Extensions ecosystem | Rich (PostGIS, pg_trgm, etc.) | Limited | Limited |
| AWS RDS Multi-AZ | Supported | Supported | Supported |
| License | PostgreSQL License (permissive) | GPL v2 | GPL v2 |
| Community activity | Very active | Active | Active |

### Key Differentiators

1. **`jsonb` data type**: PostgreSQL's binary JSON type provides efficient storage, GIN indexing, and rich query operators. This eliminates the need for a separate document store for semi-structured data.

2. **Advanced indexing**: Partial indexes reduce index storage and maintenance overhead. GIN indexes accelerate full-text search and JSON queries without external search engines.

3. **Extension ecosystem**: PostGIS for geospatial data, `pg_trgm` for fuzzy text matching, and `pg_stat_statements` for query performance analysis are available as managed extensions on RDS.

4. **Standards compliance**: PostgreSQL has the most complete implementation of the SQL standard among open-source databases, reducing vendor lock-in risk.

## Consequences

### Positive

- **Reduced architectural complexity**: Native JSON support eliminates the need for a separate NoSQL database for semi-structured data.
- **Strong data integrity**: Full ACID compliance with robust constraint enforcement protects against data corruption.
- **Performance visibility**: Performance Insights and `pg_stat_statements` provide deep query-level performance analysis.
- **Permissive licensing**: The PostgreSQL License allows unrestricted use without GPL obligations.
- **Mature migration tooling**: Tools like `pg_dump`, `pg_restore`, and AWS DMS support straightforward migration and backup strategies.

### Negative

- **Connection overhead**: PostgreSQL uses a process-per-connection model, which consumes more memory per connection than MySQL's thread-per-connection model. Mitigation: use RDS Proxy or PgBouncer for connection pooling.
- **Replication complexity**: Logical replication setup is more complex than MySQL's binary log replication. Mitigation: RDS manages replication for Multi-AZ and read replicas automatically.
- **Team familiarity**: Some team members may have more experience with MySQL. Mitigation: PostgreSQL and MySQL share core SQL syntax; the learning curve is manageable.

### Neutral

- **RDS management overhead**: Identical for all supported engines. AWS handles patching, backups, and failover regardless of the engine choice.
- **Cost**: RDS pricing is the same for PostgreSQL and MySQL on equivalent instance classes.

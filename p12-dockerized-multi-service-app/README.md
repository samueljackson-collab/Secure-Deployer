# P12: Dockerized Multi-Service App

A production-ready multi-service application orchestrated with Docker Compose, featuring an Nginx reverse proxy, Flask REST API, Celery background workers, Redis message broker, and PostgreSQL database.

## Architecture

```
                 ┌──────────────────────────────────────────────────┐
                 │                 Docker Network                   │
  Client ──────>│  ┌───────┐    ┌─────┐    ┌────────┐             │
    :80         │  │ Nginx │───>│ API │───>│ Worker │             │
                 │  │(proxy)│    │Flask│    │Celery  │             │
                 │  └───────┘    └──┬──┘    └───┬────┘             │
                 │    frontend      │  backend  │                  │
                 │   network        │  network  │                  │
                 │              ┌───┴───┐  ┌────┴─────┐            │
                 │              │ Redis │  │PostgreSQL│            │
                 │              │broker │  │   DB     │            │
                 │              └───────┘  └──────────┘            │
                 └──────────────────────────────────────────────────┘
```

### Services

| Service    | Image / Build        | Role                          | Network(s)         |
|------------|----------------------|-------------------------------|--------------------|
| **nginx**  | `nginx:1.25-alpine`  | Reverse proxy, TLS, headers   | frontend           |
| **api**    | `./api` (Flask)      | REST API (Gunicorn)           | frontend, backend  |
| **worker** | `./api` (Celery)     | Async task processing         | backend            |
| **redis**  | `redis:7-alpine`     | Message broker + cache        | backend            |
| **postgres** | `postgres:16-alpine` | Persistent data store       | backend            |

### Networking

- **frontend**: Exposes only Nginx to the host on port 80. The API container is reachable from Nginx but not directly from the host.
- **backend** (`internal: true`): Isolated network for database, Redis, and worker communication. No external access is possible.

## Quick Start

```bash
# Clone the repository and navigate to this project
cd p12-dockerized-multi-service-app

# Start all services
docker compose up -d

# Verify health
docker compose ps

# View logs
docker compose logs -f api

# Run a test request
curl http://localhost/api/tasks -X POST -H "Content-Type: application/json" \
  -d '{"task_type": "example", "payload": {"key": "value"}}'

# Stop all services
docker compose down
```

## API Endpoints

| Method | Path               | Description                    |
|--------|--------------------|--------------------------------|
| GET    | `/health`          | Health check                   |
| POST   | `/api/tasks`       | Queue a new background task    |
| GET    | `/api/tasks`       | List all tasks                 |
| GET    | `/api/tasks/<id>`  | Get task status and result     |

### Example: Create a Task

```bash
curl -X POST http://localhost/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"task_type": "process_data", "payload": {"input": "sample"}}'
```

Response:
```json
{
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "PENDING"
}
```

## Development Workflow

1. **Make code changes** in the `api/` directory.
2. **Rebuild** only the affected service:
   ```bash
   docker compose up -d --build api
   ```
3. **Run tests** inside the container:
   ```bash
   docker compose exec api python -m pytest
   ```
4. **View real-time logs**:
   ```bash
   docker compose logs -f api worker
   ```
5. **Database access**:
   ```bash
   docker compose exec postgres psql -U app -d appdb
   ```

## Environment Variables

| Variable       | Service       | Description                      | Default                                      |
|----------------|---------------|----------------------------------|----------------------------------------------|
| `DATABASE_URL` | api, worker   | PostgreSQL connection string     | `postgresql://app:secret@postgres:5432/appdb` |
| `REDIS_URL`    | api, worker   | Redis connection string          | `redis://redis:6379/0`                       |
| `POSTGRES_DB`  | postgres      | Database name                    | `appdb`                                      |
| `POSTGRES_USER`| postgres      | Database user                    | `app`                                        |
| `POSTGRES_PASSWORD` | postgres | Database password                | `secret`                                     |

> **Warning**: The default credentials are for local development only. Always use secrets management for production deployments.

## Resource Limits

| Service  | Memory | CPU    |
|----------|--------|--------|
| nginx    | 128M   | 0.25   |

Resource limits can be extended to all services by editing `docker-compose.yml`.

## Project Structure

```
p12-dockerized-multi-service-app/
├── README.md
├── CHANGELOG.md
├── docker-compose.yml
├── nginx.conf
├── api/
│   ├── Dockerfile
│   ├── app.py
│   └── requirements.txt
└── docs/
    ├── threat-model.md
    └── adr/
        └── 001-use-docker-compose-for-local-dev.md
```

## License

This project is provided for educational and portfolio demonstration purposes.

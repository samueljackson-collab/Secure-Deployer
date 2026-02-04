"""Flask application with Celery background task processing."""

import os
import uuid
import logging
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from celery import Celery
import psycopg2
from psycopg2.extras import RealDictCursor
import redis

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://app:secret@postgres:5432/appdb"
)
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------

app = Flask(__name__)
app.config["CELERY_BROKER_URL"] = REDIS_URL
app.config["CELERY_RESULT_BACKEND"] = REDIS_URL

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------

celery = Celery(
    app.import_name,
    broker=REDIS_URL,
    backend=REDIS_URL,
)
celery.conf.update(app.config)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def get_db_connection():
    """Return a new database connection."""
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def init_db():
    """Create the tasks table if it does not exist."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id          TEXT PRIMARY KEY,
                    task_type   TEXT NOT NULL,
                    payload     JSONB DEFAULT '{}'::jsonb,
                    status      TEXT NOT NULL DEFAULT 'PENDING',
                    result      JSONB,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """
            )
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------


@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def process_task(self, task_id: str, task_type: str, payload: dict):
    """Process a background task and store the result in PostgreSQL."""
    logger.info("Processing task %s (type=%s)", task_id, task_type)
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE tasks SET status = %s, updated_at = now() WHERE id = %s",
                ("PROCESSING", task_id),
            )

        # Simulate task work based on type
        result = {"task_type": task_type, "processed": True, "payload": payload}

        with conn.cursor() as cur:
            cur.execute(
                """UPDATE tasks
                   SET status = %s, result = %s::jsonb, updated_at = now()
                   WHERE id = %s""",
                ("COMPLETED", jsonify_safe(result), task_id),
            )
        logger.info("Task %s completed successfully", task_id)
    except Exception as exc:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE tasks SET status = %s, updated_at = now() WHERE id = %s",
                ("FAILED", task_id),
            )
        logger.error("Task %s failed: %s", task_id, exc)
        raise self.retry(exc=exc)
    finally:
        conn.close()


def jsonify_safe(obj):
    """Serialize an object to a JSON string for PostgreSQL."""
    import json

    return json.dumps(obj)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.route("/health")
def health():
    """Health check endpoint that verifies database and Redis connectivity."""
    health_status = {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}
    checks = {}

    # Check PostgreSQL
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.close()
        checks["postgres"] = "ok"
    except Exception as exc:
        checks["postgres"] = f"error: {exc}"
        health_status["status"] = "unhealthy"

    # Check Redis
    try:
        r = redis.from_url(REDIS_URL)
        r.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"error: {exc}"
        health_status["status"] = "unhealthy"

    health_status["checks"] = checks
    status_code = 200 if health_status["status"] == "healthy" else 503
    return jsonify(health_status), status_code


@app.route("/api/tasks", methods=["POST"])
def create_task():
    """Queue a new background task."""
    data = request.get_json(silent=True) or {}
    task_type = data.get("task_type", "default")
    payload = data.get("payload", {})
    task_id = str(uuid.uuid4())

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO tasks (id, task_type, payload, status)
                   VALUES (%s, %s, %s::jsonb, %s)""",
                (task_id, task_type, jsonify_safe(payload), "PENDING"),
            )
    finally:
        conn.close()

    # Dispatch to Celery
    process_task.delay(task_id, task_type, payload)
    logger.info("Task %s queued (type=%s)", task_id, task_type)

    return jsonify({"task_id": task_id, "status": "PENDING"}), 201


@app.route("/api/tasks", methods=["GET"])
def list_tasks():
    """List all tasks ordered by creation time (newest first)."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, task_type, status, created_at, updated_at FROM tasks ORDER BY created_at DESC LIMIT 100"
            )
            tasks = cur.fetchall()
    finally:
        conn.close()

    # Convert datetimes to ISO format strings
    for task in tasks:
        task["created_at"] = task["created_at"].isoformat()
        task["updated_at"] = task["updated_at"].isoformat()

    return jsonify({"tasks": tasks, "count": len(tasks)})


@app.route("/api/tasks/<task_id>", methods=["GET"])
def get_task(task_id):
    """Get the status and result of a specific task."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM tasks WHERE id = %s", (task_id,))
            task = cur.fetchone()
    finally:
        conn.close()

    if task is None:
        return jsonify({"error": "Task not found"}), 404

    task["created_at"] = task["created_at"].isoformat()
    task["updated_at"] = task["updated_at"].isoformat()

    return jsonify(task)


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------

# Initialize the database table on import so both the API and worker
# containers create the table if it does not yet exist.
try:
    init_db()
    logger.info("Database initialized successfully")
except Exception as exc:
    logger.warning("Could not initialize database (will retry on first request): %s", exc)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

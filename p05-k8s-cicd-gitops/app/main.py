"""Simple Flask application for GitOps demonstration."""
from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route("/health")
def health():
    return jsonify({"status": "healthy"}), 200

@app.route("/ready")
def ready():
    return jsonify({"status": "ready"}), 200

@app.route("/")
def index():
    return jsonify({
        "app": "gitops-demo",
        "version": os.getenv("APP_VERSION", "1.0.0"),
        "environment": os.getenv("ENVIRONMENT", "development")
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)

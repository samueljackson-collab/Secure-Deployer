"""
Core validation engine for IAM policy JSON documents.

Each check function receives a policy statement (dict) and the statement index,
and returns a list of Finding dicts.  The ``validate_policy`` function
orchestrates all checks against a full policy document and returns structured
results.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

# ── Finding severities ──────────────────────────────────────────────────────

SEVERITY_HIGH = "HIGH"
SEVERITY_MEDIUM = "MEDIUM"
SEVERITY_LOW = "LOW"

# ── Sensitive actions that should always have a Condition block ──────────────

SENSITIVE_ACTIONS: set[str] = {
    "sts:AssumeRole",
    "iam:CreateUser",
    "iam:CreateRole",
    "iam:AttachRolePolicy",
    "iam:AttachUserPolicy",
    "iam:PutRolePolicy",
    "iam:PutUserPolicy",
    "iam:CreateAccessKey",
    "iam:CreateLoginProfile",
    "iam:UpdateLoginProfile",
    "iam:PassRole",
    "organizations:CreateAccount",
    "lambda:InvokeFunction",
    "s3:DeleteBucket",
    "ec2:RunInstances",
}


# ── Helper utilities ────────────────────────────────────────────────────────

def _ensure_list(value: Any) -> list:
    """Normalise a scalar or list value into a list."""
    if isinstance(value, list):
        return value
    return [value]


def _make_finding(
    check_id: str,
    severity: str,
    message: str,
    statement_index: Optional[int] = None,
) -> Dict[str, Any]:
    """Create a structured finding dict."""
    finding: Dict[str, Any] = {
        "check_id": check_id,
        "severity": severity,
        "message": message,
    }
    if statement_index is not None:
        finding["statement_index"] = statement_index
    return finding


# ── Individual check functions ──────────────────────────────────────────────

def check_wildcard_action(
    statement: Dict[str, Any], index: int
) -> List[Dict[str, Any]]:
    """Flag statements where Action contains '*'."""
    findings: List[Dict[str, Any]] = []
    actions = _ensure_list(statement.get("Action", []))
    for action in actions:
        if action == "*":
            findings.append(
                _make_finding(
                    "WILDCARD_ACTION",
                    SEVERITY_HIGH,
                    f"Statement {index}: Action contains wildcard '*'. "
                    "Specify explicit actions instead.",
                    index,
                )
            )
            break  # One finding per statement is sufficient.
    return findings


def check_wildcard_resource(
    statement: Dict[str, Any], index: int
) -> List[Dict[str, Any]]:
    """Flag statements where Resource contains '*'."""
    findings: List[Dict[str, Any]] = []
    resources = _ensure_list(statement.get("Resource", []))
    for resource in resources:
        if resource == "*":
            findings.append(
                _make_finding(
                    "WILDCARD_RESOURCE",
                    SEVERITY_HIGH,
                    f"Statement {index}: Resource contains wildcard '*'. "
                    "Scope to specific ARNs.",
                    index,
                )
            )
            break
    return findings


def check_missing_condition(
    statement: Dict[str, Any], index: int
) -> List[Dict[str, Any]]:
    """Flag sensitive actions that lack a Condition block."""
    findings: List[Dict[str, Any]] = []
    actions = _ensure_list(statement.get("Action", []))
    has_condition = bool(statement.get("Condition"))

    if has_condition:
        return findings

    for action in actions:
        if action in SENSITIVE_ACTIONS:
            findings.append(
                _make_finding(
                    "MISSING_CONDITION",
                    SEVERITY_MEDIUM,
                    f"Statement {index}: Sensitive action '{action}' "
                    "has no Condition block. Add conditions to restrict usage.",
                    index,
                )
            )
            break  # One finding per statement.
    return findings


def check_overly_permissive_principal(
    statement: Dict[str, Any], index: int
) -> List[Dict[str, Any]]:
    """Flag statements where Principal is '*' or {"AWS": "*"}."""
    findings: List[Dict[str, Any]] = []
    principal = statement.get("Principal")

    if principal is None:
        return findings

    is_permissive = False
    if principal == "*":
        is_permissive = True
    elif isinstance(principal, dict):
        for _key, value in principal.items():
            values = _ensure_list(value)
            if "*" in values:
                is_permissive = True
                break

    if is_permissive:
        findings.append(
            _make_finding(
                "OVERLY_PERMISSIVE_PRINCIPAL",
                SEVERITY_HIGH,
                f"Statement {index}: Principal is overly permissive ('*'). "
                "Restrict to specific accounts, roles, or services.",
                index,
            )
        )
    return findings


def check_not_action(
    statement: Dict[str, Any], index: int
) -> List[Dict[str, Any]]:
    """Flag use of NotAction (inversion anti-pattern)."""
    findings: List[Dict[str, Any]] = []
    if "NotAction" in statement:
        findings.append(
            _make_finding(
                "NOT_ACTION_USAGE",
                SEVERITY_MEDIUM,
                f"Statement {index}: Uses 'NotAction' which inverts the "
                "action match.  This can inadvertently grant access to all "
                "other actions.  Prefer explicit 'Action' lists.",
                index,
            )
        )
    return findings


def check_not_resource(
    statement: Dict[str, Any], index: int
) -> List[Dict[str, Any]]:
    """Flag use of NotResource (inversion anti-pattern)."""
    findings: List[Dict[str, Any]] = []
    if "NotResource" in statement:
        findings.append(
            _make_finding(
                "NOT_RESOURCE_USAGE",
                SEVERITY_MEDIUM,
                f"Statement {index}: Uses 'NotResource' which inverts the "
                "resource match.  This can inadvertently grant access to all "
                "other resources.  Prefer explicit 'Resource' lists.",
                index,
            )
        )
    return findings


# ── Check registry ──────────────────────────────────────────────────────────

CHECKS = [
    check_wildcard_action,
    check_wildcard_resource,
    check_missing_condition,
    check_overly_permissive_principal,
    check_not_action,
    check_not_resource,
]


# ── Public API ──────────────────────────────────────────────────────────────

def validate_policy_document(
    policy: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Validate a parsed IAM policy document (dict).

    Parameters
    ----------
    policy : dict
        A parsed IAM policy document.  Expected to have a top-level
        ``Statement`` key containing a list of statement dicts.

    Returns
    -------
    list[dict]
        A list of finding dicts.  Empty list means no issues detected.
    """
    findings: List[Dict[str, Any]] = []

    statements = policy.get("Statement")
    if statements is None:
        findings.append(
            _make_finding(
                "INVALID_POLICY",
                SEVERITY_HIGH,
                "Policy document is missing the 'Statement' key.",
            )
        )
        return findings

    if not isinstance(statements, list):
        statements = [statements]

    for idx, statement in enumerate(statements):
        for check_fn in CHECKS:
            findings.extend(check_fn(statement, idx))

    return findings


def validate_policy_file(file_path: str) -> Dict[str, Any]:
    """
    Load an IAM policy JSON file, validate it, and return structured results.

    Parameters
    ----------
    file_path : str
        Path to the IAM policy JSON file.

    Returns
    -------
    dict
        A result dict with keys:
        - ``file``     : the file path inspected.
        - ``valid``    : bool -- True if the file was parseable JSON.
        - ``findings`` : list of finding dicts.
        - ``error``    : str or None -- set if the file could not be loaded.
    """
    result: Dict[str, Any] = {
        "file": file_path,
        "valid": False,
        "findings": [],
        "error": None,
    }

    path = Path(file_path)

    if not path.exists():
        result["error"] = f"File not found: {file_path}"
        return result

    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        result["error"] = f"Unable to read file: {exc}"
        return result

    try:
        policy = json.loads(text)
    except json.JSONDecodeError as exc:
        result["error"] = f"Invalid JSON: {exc}"
        return result

    if not isinstance(policy, dict):
        result["error"] = "Policy document must be a JSON object."
        return result

    result["valid"] = True
    result["findings"] = validate_policy_document(policy)
    return result

#!/usr/bin/env python3
"""IAM Policy Validator CLI - Analyze IAM policies for security issues."""
import argparse
import json
import sys
from pathlib import Path
from validator import validate_policy_document


def main():
    parser = argparse.ArgumentParser(
        description="Validate AWS IAM policies for security best practices"
    )
    parser.add_argument("policy_file", help="Path to IAM policy JSON file")
    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on warnings (MEDIUM severity) too",
    )
    args = parser.parse_args()

    policy_path = Path(args.policy_file)
    if not policy_path.exists():
        print(f"Error: File not found: {args.policy_file}", file=sys.stderr)
        sys.exit(2)

    try:
        with open(policy_path) as f:
            policy = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON: {e}", file=sys.stderr)
        sys.exit(2)

    findings = validate_policy_document(policy)

    if args.format == "json":
        print(
            json.dumps(
                {"findings": findings, "total": len(findings)},
                indent=2,
            )
        )
    else:
        if not findings:
            print("No issues found. Policy follows best practices.")
        for f in findings:
            print(f"[{f['severity']}] {f['check_id']}: {f['message']}")

    high = [f for f in findings if f["severity"] == "HIGH"]
    medium = [f for f in findings if f["severity"] == "MEDIUM"]
    if high or (args.strict and medium):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()

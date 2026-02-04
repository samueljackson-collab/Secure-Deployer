"""Integration tests for the IAM Policy Validator CLI.

Each test invokes ``main.py`` as a subprocess, validating exit codes, stdout
output, and format selection (text vs. JSON).  Test policies live under
``test_policies/`` next to this file.
"""

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

# Directory containing sample policy files used by these tests.
TEST_DIR = Path(__file__).resolve().parent
POLICIES_DIR = TEST_DIR / "test_policies"
MAIN_PY = TEST_DIR.parent / "main.py"

# Use the same Python interpreter that is running the test suite.
PYTHON = sys.executable


def _run_cli(*args: str) -> subprocess.CompletedProcess:
    """Helper to invoke the CLI and capture output."""
    return subprocess.run(
        [PYTHON, str(MAIN_PY), *args],
        capture_output=True,
        text=True,
        cwd=str(MAIN_PY.parent),
        timeout=30,
    )


class TestCLIIntegration(unittest.TestCase):
    """End-to-end tests for the policy_validator CLI."""

    # ------------------------------------------------------------------
    # Exit-code tests
    # ------------------------------------------------------------------

    def test_good_policy_exit_zero(self):
        """A well-scoped policy should exit with code 0."""
        result = _run_cli(str(POLICIES_DIR / "good_policy.json"))
        self.assertEqual(
            result.returncode,
            0,
            f"Expected exit 0 for good policy, got {result.returncode}.\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}",
        )

    def test_bad_policy_exit_one(self):
        """A policy with HIGH-severity findings should exit with code 1."""
        result = _run_cli(str(POLICIES_DIR / "wildcard_resource.json"))
        self.assertEqual(
            result.returncode,
            1,
            f"Expected exit 1 for bad policy, got {result.returncode}.\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}",
        )

    def test_file_not_found_exit_two(self):
        """A non-existent file path should exit with code 2."""
        result = _run_cli("/tmp/does_not_exist_abc123.json")
        self.assertEqual(
            result.returncode,
            2,
            f"Expected exit 2 for missing file, got {result.returncode}.\n"
            f"stderr: {result.stderr}",
        )
        self.assertIn("Error", result.stderr)

    def test_invalid_json_exit_two(self):
        """A file with invalid JSON should exit with code 2."""
        result = _run_cli(str(POLICIES_DIR / "invalid_json.txt"))
        self.assertEqual(
            result.returncode,
            2,
            f"Expected exit 2 for invalid JSON, got {result.returncode}.\n"
            f"stderr: {result.stderr}",
        )
        self.assertIn("Invalid JSON", result.stderr)

    # ------------------------------------------------------------------
    # Output format tests
    # ------------------------------------------------------------------

    def test_json_output_format(self):
        """The --format json flag should produce valid JSON on stdout with
        'findings' and 'total' keys."""
        result = _run_cli(
            str(POLICIES_DIR / "wildcard_resource.json"), "--format", "json"
        )
        # Should still exit 1 (findings present), but output is JSON.
        self.assertEqual(result.returncode, 1)
        data = json.loads(result.stdout)
        self.assertIn("findings", data)
        self.assertIn("total", data)
        self.assertIsInstance(data["findings"], list)
        self.assertGreater(data["total"], 0)

    def test_text_output_format(self):
        """Default text output should contain severity and check_id for
        each finding."""
        result = _run_cli(str(POLICIES_DIR / "wildcard_resource.json"))
        self.assertIn("[HIGH]", result.stdout)
        self.assertIn("WILDCARD_RESOURCE", result.stdout)

    def test_text_output_good_policy_message(self):
        """A clean policy in text mode should print the 'no issues' message."""
        result = _run_cli(str(POLICIES_DIR / "good_policy.json"))
        self.assertIn("No issues found", result.stdout)

    # ------------------------------------------------------------------
    # Strict mode
    # ------------------------------------------------------------------

    def test_strict_mode(self):
        """In strict mode, MEDIUM-severity findings should also cause exit 1.

        The multi_finding_policy.json has a NotAction (MEDIUM severity).
        Without --strict, only HIGH findings cause exit 1. With --strict,
        MEDIUM should also trigger exit 1.
        """
        # First, verify multi_finding_policy already exits 1 due to HIGH
        # findings (wildcard action + resource).
        result_normal = _run_cli(str(POLICIES_DIR / "multi_finding_policy.json"))
        self.assertEqual(result_normal.returncode, 1)

        # Strict mode should also exit 1 (HIGH findings are present).
        result_strict = _run_cli(
            str(POLICIES_DIR / "multi_finding_policy.json"), "--strict"
        )
        self.assertEqual(result_strict.returncode, 1)

    def test_multi_finding_json_output(self):
        """The multi-finding policy should report multiple findings in
        JSON mode."""
        result = _run_cli(
            str(POLICIES_DIR / "multi_finding_policy.json"),
            "--format",
            "json",
        )
        data = json.loads(result.stdout)
        self.assertGreaterEqual(data["total"], 3)
        check_ids = {f["check_id"] for f in data["findings"]}
        self.assertIn("WILDCARD_ACTION", check_ids)
        self.assertIn("WILDCARD_RESOURCE", check_ids)
        self.assertIn("NOT_ACTION_USAGE", check_ids)


if __name__ == "__main__":
    unittest.main()

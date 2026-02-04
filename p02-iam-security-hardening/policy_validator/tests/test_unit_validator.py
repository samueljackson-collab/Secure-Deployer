"""Unit tests for the IAM Policy Validator engine.

Tests cover every check implemented in ``validator.py``, including edge cases
such as empty policies, Deny-effect statements, and statements with multiple
concurrent findings.
"""

import unittest
import sys
import os

# Ensure the policy_validator package is importable when running tests directly.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from validator import (
    validate_policy_document,
    check_wildcard_action,
    check_wildcard_resource,
    check_missing_condition,
    check_not_action,
    check_not_resource,
    check_overly_permissive_principal,
)


class TestPolicyValidator(unittest.TestCase):
    """Comprehensive test suite for validate_policy_document."""

    # ------------------------------------------------------------------
    # Positive / clean policy tests
    # ------------------------------------------------------------------

    def test_good_policy_no_findings(self):
        """A well-scoped policy with explicit actions, specific resources, and
        a condition block should produce zero findings."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject", "s3:ListBucket"],
                    "Resource": [
                        "arn:aws:s3:::my-bucket",
                        "arn:aws:s3:::my-bucket/*",
                    ],
                    "Condition": {
                        "StringEquals": {"aws:RequestedRegion": "us-east-1"}
                    },
                }
            ],
        }
        findings = validate_policy_document(policy)
        self.assertEqual(len(findings), 0)

    # ------------------------------------------------------------------
    # Wildcard checks
    # ------------------------------------------------------------------

    def test_wildcard_action_detected(self):
        """Action set to '*' should trigger WILDCARD_ACTION."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "*",
                    "Resource": "arn:aws:s3:::my-bucket/*",
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("WILDCARD_ACTION", check_ids)

    def test_wildcard_resource_detected(self):
        """Resource set to '*' should trigger WILDCARD_RESOURCE."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "Resource": "*",
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("WILDCARD_RESOURCE", check_ids)

    def test_wildcard_action_and_resource(self):
        """Both Action and Resource as '*' should produce at least two
        findings: WILDCARD_ACTION and WILDCARD_RESOURCE."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "*",
                    "Resource": "*",
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("WILDCARD_ACTION", check_ids)
        self.assertIn("WILDCARD_RESOURCE", check_ids)

    # ------------------------------------------------------------------
    # Missing condition check
    # ------------------------------------------------------------------

    def test_missing_condition_on_sts(self):
        """Sensitive action 'sts:AssumeRole' without a Condition should
        trigger MISSING_CONDITION."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "sts:AssumeRole",
                    "Resource": "arn:aws:iam::123456789012:role/admin",
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("MISSING_CONDITION", check_ids)

    # ------------------------------------------------------------------
    # NotAction / NotResource checks
    # ------------------------------------------------------------------

    def test_not_action_detected(self):
        """Use of NotAction should trigger NOT_ACTION_USAGE."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "NotAction": "iam:*",
                    "Resource": "arn:aws:s3:::my-bucket/*",
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("NOT_ACTION_USAGE", check_ids)

    def test_not_resource_detected(self):
        """Use of NotResource should trigger NOT_RESOURCE_USAGE."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "NotResource": "arn:aws:s3:::secret-bucket/*",
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("NOT_RESOURCE_USAGE", check_ids)

    # ------------------------------------------------------------------
    # Overly permissive principal
    # ------------------------------------------------------------------

    def test_overly_permissive_principal(self):
        """Principal set to '*' should trigger OVERLY_PERMISSIVE_PRINCIPAL."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": ["s3:GetObject"],
                    "Resource": "arn:aws:s3:::public-bucket/*",
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("OVERLY_PERMISSIVE_PRINCIPAL", check_ids)

    # ------------------------------------------------------------------
    # Multi-statement / edge cases
    # ------------------------------------------------------------------

    def test_multiple_statements(self):
        """A policy with multiple statements should check each statement
        independently and collect findings from all of them."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "*",
                    "Resource": "arn:aws:s3:::bucket-a/*",
                },
                {
                    "Effect": "Allow",
                    "Action": ["s3:GetObject"],
                    "Resource": "*",
                },
            ],
        }
        findings = validate_policy_document(policy)
        # Statement 0 -> WILDCARD_ACTION, Statement 1 -> WILDCARD_RESOURCE
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("WILDCARD_ACTION", check_ids)
        self.assertIn("WILDCARD_RESOURCE", check_ids)
        # Verify findings reference different statement indices.
        action_idx = next(
            f["statement_index"]
            for f in findings
            if f["check_id"] == "WILDCARD_ACTION"
        )
        resource_idx = next(
            f["statement_index"]
            for f in findings
            if f["check_id"] == "WILDCARD_RESOURCE"
        )
        self.assertEqual(action_idx, 0)
        self.assertEqual(resource_idx, 1)

    def test_empty_policy(self):
        """A policy document without a 'Statement' key should produce an
        INVALID_POLICY finding."""
        policy = {"Version": "2012-10-17"}
        findings = validate_policy_document(policy)
        self.assertTrue(len(findings) > 0)
        self.assertEqual(findings[0]["check_id"], "INVALID_POLICY")

    def test_policy_with_deny_effect_allowed(self):
        """Deny statements that use wildcards are intentional deny-all
        patterns and should still be flagged (the validator checks all
        statements regardless of Effect)."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Deny",
                    "Action": "*",
                    "Resource": "*",
                }
            ],
        }
        findings = validate_policy_document(policy)
        # The validator currently flags wildcards regardless of Effect.
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("WILDCARD_ACTION", check_ids)
        self.assertIn("WILDCARD_RESOURCE", check_ids)

    def test_multiple_findings_in_one_statement(self):
        """A single statement can produce multiple findings when it has
        several anti-patterns simultaneously."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "*",
                    "Resource": "*",
                    "Principal": "*",
                    "NotAction": "iam:DeleteUser",
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = {f["check_id"] for f in findings}
        # Should detect at least: WILDCARD_ACTION, WILDCARD_RESOURCE,
        # OVERLY_PERMISSIVE_PRINCIPAL, NOT_ACTION_USAGE
        self.assertTrue(
            {"WILDCARD_ACTION", "WILDCARD_RESOURCE", "OVERLY_PERMISSIVE_PRINCIPAL", "NOT_ACTION_USAGE"}
            .issubset(check_ids)
        )

    # ------------------------------------------------------------------
    # Severity levels
    # ------------------------------------------------------------------

    def test_severity_levels_correct(self):
        """Ensure that wildcard findings have HIGH severity and NotAction
        findings have MEDIUM severity."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "*",
                    "Resource": "arn:aws:s3:::bucket/*",
                },
                {
                    "Effect": "Allow",
                    "NotAction": "iam:DeleteUser",
                    "Resource": "arn:aws:s3:::bucket/*",
                },
            ],
        }
        findings = validate_policy_document(policy)
        wildcard_finding = next(
            f for f in findings if f["check_id"] == "WILDCARD_ACTION"
        )
        not_action_finding = next(
            f for f in findings if f["check_id"] == "NOT_ACTION_USAGE"
        )
        self.assertEqual(wildcard_finding["severity"], "HIGH")
        self.assertEqual(not_action_finding["severity"], "MEDIUM")

    def test_condition_present_suppresses_missing_condition(self):
        """A sensitive action WITH a Condition block should NOT trigger
        MISSING_CONDITION."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": "sts:AssumeRole",
                    "Resource": "arn:aws:iam::123456789012:role/admin",
                    "Condition": {
                        "StringEquals": {
                            "aws:PrincipalOrgID": "o-example123"
                        }
                    },
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = [f["check_id"] for f in findings]
        self.assertNotIn("MISSING_CONDITION", check_ids)

    def test_principal_aws_wildcard_detected(self):
        """Principal of the form {"AWS": "*"} should trigger
        OVERLY_PERMISSIVE_PRINCIPAL."""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": "*"},
                    "Action": ["s3:GetObject"],
                    "Resource": "arn:aws:s3:::public-bucket/*",
                }
            ],
        }
        findings = validate_policy_document(policy)
        check_ids = [f["check_id"] for f in findings]
        self.assertIn("OVERLY_PERMISSIVE_PRINCIPAL", check_ids)


if __name__ == "__main__":
    unittest.main()

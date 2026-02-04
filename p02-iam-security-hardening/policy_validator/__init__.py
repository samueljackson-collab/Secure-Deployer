"""
policy_validator -- Static analysis tool for AWS IAM policy JSON documents.

Scans IAM policies for dangerous patterns such as wildcard actions, wildcard
resources, missing condition blocks, overly permissive principals, and
NotAction/NotResource anti-patterns.
"""

__version__ = "1.0.0"

"""Shared pytest fixtures for the automation toolkit test suite.

Fixtures provide pre-configured moto mock environments so that individual
test modules do not need to repeat boilerplate setup.
"""

from __future__ import annotations

import boto3
import pytest
from moto import mock_aws


# ---------------------------------------------------------------------------
# AWS mock session fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def aws_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    """Set dummy AWS credentials so boto3 never reaches real endpoints."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")


@pytest.fixture()
def mock_ec2(aws_credentials):
    """Yield a boto3 session wrapped in moto's EC2 mock.

    The fixture starts the mock, creates a session, and yields it.
    On teardown the mock is stopped automatically.
    """
    with mock_aws():
        session = boto3.Session(region_name="us-east-1")
        yield session


@pytest.fixture()
def ec2_with_instances(mock_ec2):
    """Create a handful of EC2 instances inside the mock and yield the session.

    Instances created:
    * 2 x running with full tags (Name, Environment, Owner)
    * 1 x running with only the Name tag (missing Environment, Owner)
    * 1 x stopped with no tags at all
    """
    ec2 = mock_ec2.resource("ec2", region_name="us-east-1")

    # We need an AMI to launch instances.  Moto provides a stock one.
    client = mock_ec2.client("ec2", region_name="us-east-1")
    images = client.describe_images(
        Filters=[{"Name": "name", "Values": ["amzn2-ami-hvm-*"]}]
    )
    ami_id = images["Images"][0]["ImageId"] if images["Images"] else "ami-12345678"

    # Two fully tagged running instances.
    for idx in range(2):
        ec2.create_instances(
            ImageId=ami_id,
            MinCount=1,
            MaxCount=1,
            InstanceType="t3.micro",
            TagSpecifications=[
                {
                    "ResourceType": "instance",
                    "Tags": [
                        {"Key": "Name", "Value": f"web-server-{idx}"},
                        {"Key": "Environment", "Value": "production"},
                        {"Key": "Owner", "Value": "infra-team"},
                    ],
                }
            ],
        )

    # One partially tagged running instance.
    ec2.create_instances(
        ImageId=ami_id,
        MinCount=1,
        MaxCount=1,
        InstanceType="t3.small",
        TagSpecifications=[
            {
                "ResourceType": "instance",
                "Tags": [
                    {"Key": "Name", "Value": "partial-tags"},
                ],
            }
        ],
    )

    # One stopped instance with no tags.
    instances = ec2.create_instances(
        ImageId=ami_id,
        MinCount=1,
        MaxCount=1,
        InstanceType="t3.nano",
    )
    client.stop_instances(InstanceIds=[instances[0].id])

    yield mock_ec2

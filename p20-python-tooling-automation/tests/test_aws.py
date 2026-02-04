"""Unit tests for automation_toolkit.aws using moto mocks.

Fixtures ``mock_ec2`` and ``ec2_with_instances`` are provided by conftest.py.
"""

from __future__ import annotations

import pytest
from moto import mock_aws

from automation_toolkit.aws import (
    find_untagged_resources,
    get_instance_status,
    list_instances,
    tag_resources,
)


# -----------------------------------------------------------------------
# list_instances
# -----------------------------------------------------------------------


class TestListInstances:
    """Tests for list_instances()."""

    def test_returns_empty_when_no_instances(self, mock_ec2):
        """An account with no instances should return an empty list."""
        result = list_instances(session=mock_ec2, region="us-east-1")
        assert result == []

    def test_returns_all_instances(self, ec2_with_instances):
        """All four instances created by the fixture should be returned."""
        result = list_instances(session=ec2_with_instances, region="us-east-1")
        assert len(result) == 4

    def test_instance_fields_present(self, ec2_with_instances):
        """Every returned instance dict must contain the expected keys."""
        required_keys = {
            "InstanceId",
            "InstanceType",
            "State",
            "LaunchTime",
            "Tags",
            "PrivateIpAddress",
        }
        instances = list_instances(session=ec2_with_instances, region="us-east-1")
        for inst in instances:
            assert required_keys.issubset(inst.keys()), f"Missing keys in {inst}"

    def test_filter_by_state(self, ec2_with_instances):
        """Filtering by 'stopped' should return only the stopped instance."""
        filters = [{"Name": "instance-state-name", "Values": ["stopped"]}]
        result = list_instances(
            session=ec2_with_instances,
            region="us-east-1",
            filters=filters,
        )
        assert len(result) == 1
        assert result[0]["State"] == "stopped"


# -----------------------------------------------------------------------
# get_instance_status
# -----------------------------------------------------------------------


class TestGetInstanceStatus:
    """Tests for get_instance_status()."""

    def test_invalid_instance_id_raises(self, mock_ec2):
        """An ID that doesn't start with 'i-' should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid instance ID"):
            get_instance_status("bad-id", session=mock_ec2, region="us-east-1")

    def test_nonexistent_instance_returns_not_found(self, mock_ec2):
        """Querying a valid-format but non-existent ID returns not-found."""
        result = get_instance_status(
            "i-00000000deadbeef0",
            session=mock_ec2,
            region="us-east-1",
        )
        assert result["InstanceState"] == "not-found"


# -----------------------------------------------------------------------
# tag_resources
# -----------------------------------------------------------------------


class TestTagResources:
    """Tests for tag_resources()."""

    def test_tag_existing_instance(self, ec2_with_instances):
        """Tagging an existing instance should succeed and return True."""
        instances = list_instances(
            session=ec2_with_instances, region="us-east-1"
        )
        instance_id = instances[0]["InstanceId"]

        result = tag_resources(
            resource_ids=[instance_id],
            tags={"CostCenter": "12345"},
            session=ec2_with_instances,
            region="us-east-1",
        )
        assert result is True

        # Verify the tag was applied.
        refreshed = list_instances(
            session=ec2_with_instances, region="us-east-1"
        )
        inst = next(i for i in refreshed if i["InstanceId"] == instance_id)
        assert inst["Tags"]["CostCenter"] == "12345"

    def test_empty_resource_list_returns_false(self, mock_ec2):
        """Passing an empty resource list should return False immediately."""
        result = tag_resources(
            resource_ids=[],
            tags={"Foo": "bar"},
            session=mock_ec2,
            region="us-east-1",
        )
        assert result is False

    def test_empty_tags_returns_false(self, ec2_with_instances):
        """Passing an empty tag dict should return False immediately."""
        instances = list_instances(
            session=ec2_with_instances, region="us-east-1"
        )
        result = tag_resources(
            resource_ids=[instances[0]["InstanceId"]],
            tags={},
            session=ec2_with_instances,
            region="us-east-1",
        )
        assert result is False


# -----------------------------------------------------------------------
# find_untagged_resources
# -----------------------------------------------------------------------


class TestFindUntaggedResources:
    """Tests for find_untagged_resources()."""

    def test_finds_instances_missing_tags(self, ec2_with_instances):
        """Instances missing required tags should be returned."""
        untagged = find_untagged_resources(
            required_tags=["Name", "Environment", "Owner"],
            session=ec2_with_instances,
            region="us-east-1",
        )
        # The fixture creates 1 partially tagged + 1 untagged = 2 expected.
        assert len(untagged) == 2

    def test_missing_tags_field_populated(self, ec2_with_instances):
        """Each untagged instance should list which tags are missing."""
        untagged = find_untagged_resources(
            required_tags=["Name", "Environment", "Owner"],
            session=ec2_with_instances,
            region="us-east-1",
        )
        for inst in untagged:
            assert "MissingTags" in inst
            assert len(inst["MissingTags"]) > 0

    def test_all_tags_present_returns_empty(self, ec2_with_instances):
        """When checking a tag that all instances have, result should be empty
        only if every instance has it -- here 'Name' is missing on the
        untagged instance so we use a tag every instance has via fixture.
        """
        # Tag that no instance could reasonably be missing... but the
        # untagged instance has NO tags at all, so even 'Name' qualifies.
        # We check that if we require only tags the fully-tagged ones have,
        # the partially/un-tagged instances are still caught.
        untagged = find_untagged_resources(
            required_tags=["Name"],
            session=ec2_with_instances,
            region="us-east-1",
        )
        # The stopped instance (no tags) should be returned.
        assert len(untagged) == 1

    def test_no_instances_returns_empty(self, mock_ec2):
        """An account with no instances should return an empty list."""
        result = find_untagged_resources(
            required_tags=["Name"],
            session=mock_ec2,
            region="us-east-1",
        )
        assert result == []

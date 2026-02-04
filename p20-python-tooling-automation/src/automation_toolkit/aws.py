"""AWS utility functions for EC2 instance management and resource tagging.

All functions accept an optional ``boto3.Session`` so that callers can
inject mock sessions during testing.  When no session is provided the
default credential chain is used.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------
InstanceInfo = Dict[str, Any]
TagSpec = Dict[str, str]


# ---------------------------------------------------------------------------
# Session helper
# ---------------------------------------------------------------------------

def _get_ec2_client(
    session: Optional[boto3.Session] = None,
    region: Optional[str] = None,
) -> Any:
    """Return an EC2 client from the given session or default credentials.

    Parameters
    ----------
    session:
        An explicit ``boto3.Session``.  When *None* a new session is created
        using the default credential chain.
    region:
        AWS region name.  Falls back to the session / environment default.

    Returns
    -------
    botocore.client.EC2
    """
    sess = session or boto3.Session()
    kwargs: Dict[str, str] = {}
    if region:
        kwargs["region_name"] = region
    return sess.client("ec2", **kwargs)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def list_instances(
    session: Optional[boto3.Session] = None,
    region: Optional[str] = None,
    filters: Optional[List[Dict[str, Any]]] = None,
) -> List[InstanceInfo]:
    """List EC2 instances matching the supplied filters.

    Parameters
    ----------
    session:
        Optional boto3 session.
    region:
        AWS region to query.
    filters:
        EC2 ``describe_instances`` filter list.  Defaults to all instances.

    Returns
    -------
    list[InstanceInfo]
        A flat list of dictionaries, one per instance, containing:
        ``InstanceId``, ``InstanceType``, ``State``, ``LaunchTime``,
        ``Tags``, and ``PrivateIpAddress``.
    """
    client = _get_ec2_client(session, region)
    kwargs: Dict[str, Any] = {}
    if filters:
        kwargs["Filters"] = filters

    instances: List[InstanceInfo] = []
    try:
        paginator = client.get_paginator("describe_instances")
        for page in paginator.paginate(**kwargs):
            for reservation in page.get("Reservations", []):
                for inst in reservation.get("Instances", []):
                    instances.append({
                        "InstanceId": inst["InstanceId"],
                        "InstanceType": inst.get("InstanceType", "unknown"),
                        "State": inst["State"]["Name"],
                        "LaunchTime": inst.get("LaunchTime", ""),
                        "Tags": {
                            tag["Key"]: tag["Value"]
                            for tag in inst.get("Tags", [])
                        },
                        "PrivateIpAddress": inst.get("PrivateIpAddress", ""),
                    })
    except (BotoCoreError, ClientError) as exc:
        logger.error("Failed to list instances: %s", exc)
        raise

    logger.info("Found %d instance(s)", len(instances))
    return instances


def get_instance_status(
    instance_id: str,
    session: Optional[boto3.Session] = None,
    region: Optional[str] = None,
) -> Dict[str, Any]:
    """Return detailed status checks for a single EC2 instance.

    Parameters
    ----------
    instance_id:
        The EC2 instance ID (e.g. ``i-0abcdef1234567890``).
    session:
        Optional boto3 session.
    region:
        AWS region.

    Returns
    -------
    dict
        Keys: ``InstanceId``, ``InstanceState``, ``SystemStatus``,
        ``InstanceStatus``.
    """
    if not instance_id.startswith("i-"):
        raise ValueError(f"Invalid instance ID format: {instance_id!r}")

    client = _get_ec2_client(session, region)
    try:
        response = client.describe_instance_status(
            InstanceIds=[instance_id],
            IncludeAllInstances=True,
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("Failed to get status for %s: %s", instance_id, exc)
        raise

    statuses = response.get("InstanceStatuses", [])
    if not statuses:
        return {
            "InstanceId": instance_id,
            "InstanceState": "not-found",
            "SystemStatus": "unknown",
            "InstanceStatus": "unknown",
        }

    status = statuses[0]
    return {
        "InstanceId": instance_id,
        "InstanceState": status["InstanceState"]["Name"],
        "SystemStatus": status.get("SystemStatus", {}).get("Status", "unknown"),
        "InstanceStatus": status.get("InstanceStatus", {}).get("Status", "unknown"),
    }


def tag_resources(
    resource_ids: Sequence[str],
    tags: TagSpec,
    session: Optional[boto3.Session] = None,
    region: Optional[str] = None,
) -> bool:
    """Apply tags to one or more AWS resources.

    Parameters
    ----------
    resource_ids:
        List of resource IDs (instances, volumes, snapshots, etc.).
    tags:
        Mapping of tag key to tag value.
    session:
        Optional boto3 session.
    region:
        AWS region.

    Returns
    -------
    bool
        *True* if the tagging call succeeded.
    """
    if not resource_ids:
        logger.warning("tag_resources called with empty resource list")
        return False

    if not tags:
        logger.warning("tag_resources called with empty tag map")
        return False

    client = _get_ec2_client(session, region)
    tag_list = [{"Key": k, "Value": v} for k, v in tags.items()]

    try:
        client.create_tags(Resources=list(resource_ids), Tags=tag_list)
        logger.info(
            "Tagged %d resource(s) with %d tag(s)",
            len(resource_ids),
            len(tag_list),
        )
        return True
    except (BotoCoreError, ClientError) as exc:
        logger.error("Failed to tag resources: %s", exc)
        raise


def find_untagged_resources(
    required_tags: Sequence[str],
    session: Optional[boto3.Session] = None,
    region: Optional[str] = None,
) -> List[InstanceInfo]:
    """Find EC2 instances missing one or more of the *required_tags*.

    Parameters
    ----------
    required_tags:
        Tag keys that every instance is expected to have.
    session:
        Optional boto3 session.
    region:
        AWS region.

    Returns
    -------
    list[InstanceInfo]
        Instances that are missing at least one required tag.  Each dict
        includes an extra ``MissingTags`` key listing the absent tag names.
    """
    all_instances = list_instances(session=session, region=region)
    untagged: List[InstanceInfo] = []

    for inst in all_instances:
        existing_keys = set(inst.get("Tags", {}).keys())
        missing = [tag for tag in required_tags if tag not in existing_keys]
        if missing:
            inst["MissingTags"] = missing
            untagged.append(inst)

    logger.info(
        "Found %d instance(s) missing required tags out of %d total",
        len(untagged),
        len(all_instances),
    )
    return untagged

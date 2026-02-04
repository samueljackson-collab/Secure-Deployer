#!/usr/bin/env python3
"""Standalone script to clean up stale AWS resources.

Targets
-------
* AMIs older than *N* days that are not in use.
* EBS snapshots older than *N* days with no associated AMI.
* EC2 instances missing required tags.

Safety
------
The script operates in **dry-run mode by default**.  Pass ``--execute`` to
actually deregister AMIs, delete snapshots, or terminate instances.

Usage::

    # Preview resources eligible for cleanup (safe)
    python aws_resource_cleaner.py --days 90 --dry-run

    # Execute cleanup (destructive)
    python aws_resource_cleaner.py --days 90 --execute
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("aws_resource_cleaner")


# ---------------------------------------------------------------------------
# Resource discovery
# ---------------------------------------------------------------------------

def _get_client(service: str, region: str, session: Optional[boto3.Session] = None) -> Any:
    """Return a boto3 client for the given service."""
    sess = session or boto3.Session()
    return sess.client(service, region_name=region)


def find_old_amis(
    days: int,
    region: str,
    session: Optional[boto3.Session] = None,
) -> List[Dict[str, Any]]:
    """Return self-owned AMIs whose creation date is older than *days*."""
    client = _get_client("ec2", region, session)
    now = datetime.now(timezone.utc)

    try:
        response = client.describe_images(Owners=["self"])
    except (BotoCoreError, ClientError) as exc:
        logger.error("Failed to describe images: %s", exc)
        return []

    stale: List[Dict[str, Any]] = []
    for image in response.get("Images", []):
        creation = datetime.fromisoformat(
            image["CreationDate"].replace("Z", "+00:00")
        )
        age_days = (now - creation).days
        if age_days > days:
            stale.append({
                "ImageId": image["ImageId"],
                "Name": image.get("Name", ""),
                "CreationDate": image["CreationDate"],
                "AgeDays": age_days,
            })

    logger.info("Found %d AMI(s) older than %d days", len(stale), days)
    return stale


def find_orphan_snapshots(
    days: int,
    region: str,
    session: Optional[boto3.Session] = None,
) -> List[Dict[str, Any]]:
    """Return self-owned EBS snapshots older than *days* with no live AMI."""
    client = _get_client("ec2", region, session)
    now = datetime.now(timezone.utc)

    try:
        snap_response = client.describe_snapshots(OwnerIds=["self"])
        ami_response = client.describe_images(Owners=["self"])
    except (BotoCoreError, ClientError) as exc:
        logger.error("Failed to query snapshots or AMIs: %s", exc)
        return []

    # Build a set of snapshot IDs still referenced by AMIs.
    referenced: set[str] = set()
    for image in ami_response.get("Images", []):
        for mapping in image.get("BlockDeviceMappings", []):
            ebs = mapping.get("Ebs", {})
            snap_id = ebs.get("SnapshotId")
            if snap_id:
                referenced.add(snap_id)

    orphans: List[Dict[str, Any]] = []
    for snap in snap_response.get("Snapshots", []):
        start_time = snap["StartTime"]
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        age_days = (now - start_time).days
        if age_days > days and snap["SnapshotId"] not in referenced:
            orphans.append({
                "SnapshotId": snap["SnapshotId"],
                "Description": snap.get("Description", ""),
                "StartTime": str(snap["StartTime"]),
                "AgeDays": age_days,
            })

    logger.info("Found %d orphan snapshot(s) older than %d days", len(orphans), days)
    return orphans


def find_untagged_instances(
    required_tags: List[str],
    region: str,
    session: Optional[boto3.Session] = None,
) -> List[Dict[str, Any]]:
    """Return instances missing any of the *required_tags*."""
    client = _get_client("ec2", region, session)

    try:
        paginator = client.get_paginator("describe_instances")
        pages = paginator.paginate()
    except (BotoCoreError, ClientError) as exc:
        logger.error("Failed to describe instances: %s", exc)
        return []

    untagged: List[Dict[str, Any]] = []
    for page in pages:
        for reservation in page.get("Reservations", []):
            for inst in reservation.get("Instances", []):
                tag_keys = {t["Key"] for t in inst.get("Tags", [])}
                missing = [t for t in required_tags if t not in tag_keys]
                if missing:
                    untagged.append({
                        "InstanceId": inst["InstanceId"],
                        "State": inst["State"]["Name"],
                        "MissingTags": missing,
                    })

    logger.info(
        "Found %d instance(s) missing required tags",
        len(untagged),
    )
    return untagged


# ---------------------------------------------------------------------------
# Cleanup actions
# ---------------------------------------------------------------------------

def deregister_amis(
    amis: List[Dict[str, Any]],
    region: str,
    dry_run: bool = True,
    session: Optional[boto3.Session] = None,
) -> int:
    """Deregister the supplied AMIs.  Returns the count of AMIs processed."""
    if not amis:
        return 0

    client = _get_client("ec2", region, session)
    count = 0

    for ami in amis:
        image_id = ami["ImageId"]
        if dry_run:
            logger.info("[DRY-RUN] Would deregister AMI %s (%s)", image_id, ami.get("Name", ""))
        else:
            try:
                client.deregister_image(ImageId=image_id)
                logger.info("Deregistered AMI %s", image_id)
                count += 1
            except (BotoCoreError, ClientError) as exc:
                logger.error("Failed to deregister AMI %s: %s", image_id, exc)

    return count


def delete_snapshots(
    snapshots: List[Dict[str, Any]],
    region: str,
    dry_run: bool = True,
    session: Optional[boto3.Session] = None,
) -> int:
    """Delete the supplied EBS snapshots.  Returns the count deleted."""
    if not snapshots:
        return 0

    client = _get_client("ec2", region, session)
    count = 0

    for snap in snapshots:
        snap_id = snap["SnapshotId"]
        if dry_run:
            logger.info("[DRY-RUN] Would delete snapshot %s", snap_id)
        else:
            try:
                client.delete_snapshot(SnapshotId=snap_id)
                logger.info("Deleted snapshot %s", snap_id)
                count += 1
            except (BotoCoreError, ClientError) as exc:
                logger.error("Failed to delete snapshot %s: %s", snap_id, exc)

    return count


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Clean up stale AWS resources (AMIs, snapshots, untagged instances).",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=90,
        help="Age threshold in days (default: 90).",
    )
    parser.add_argument(
        "--region",
        default="us-east-1",
        help="AWS region (default: us-east-1).",
    )
    parser.add_argument(
        "--required-tags",
        default="Name,Environment,Owner",
        help="Comma-separated required tag keys (default: Name,Environment,Owner).",
    )

    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Preview changes without applying (default).",
    )
    mode.add_argument(
        "--execute",
        action="store_true",
        dest="execute",
        default=False,
        help="Actually perform destructive cleanup.",
    )

    parser.add_argument(
        "--max-resources",
        type=int,
        default=50,
        help="Abort if more than this many resources would be affected (default: 50).",
    )

    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    """Entry point."""
    args = parse_args(argv)
    dry_run = not args.execute
    required_tags = [t.strip() for t in args.required_tags.split(",") if t.strip()]

    mode_label = "DRY-RUN" if dry_run else "EXECUTE"
    logger.info("Starting resource cleanup [%s] region=%s days=%d", mode_label, args.region, args.days)

    # --- Discover ---
    old_amis = find_old_amis(args.days, args.region)
    orphan_snaps = find_orphan_snapshots(args.days, args.region)
    untagged = find_untagged_instances(required_tags, args.region)

    total = len(old_amis) + len(orphan_snaps) + len(untagged)
    logger.info("Total resources eligible for action: %d", total)

    if total > args.max_resources:
        logger.error(
            "Resource count (%d) exceeds --max-resources (%d). Aborting for safety.",
            total,
            args.max_resources,
        )
        return 1

    # --- Act ---
    deregister_amis(old_amis, args.region, dry_run=dry_run)
    delete_snapshots(orphan_snaps, args.region, dry_run=dry_run)

    if untagged:
        for inst in untagged:
            if dry_run:
                logger.info(
                    "[DRY-RUN] Instance %s is missing tags: %s",
                    inst["InstanceId"],
                    ", ".join(inst["MissingTags"]),
                )
            else:
                logger.warning(
                    "Instance %s is missing tags: %s -- manual review required",
                    inst["InstanceId"],
                    ", ".join(inst["MissingTags"]),
                )

    logger.info("Resource cleanup complete [%s]", mode_label)
    return 0


if __name__ == "__main__":
    sys.exit(main())

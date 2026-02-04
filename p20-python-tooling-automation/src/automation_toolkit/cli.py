"""Click CLI entry point for the automation toolkit.

Provides the following top-level commands:

* ``aws-inventory``      - List and filter EC2 instances.
* ``cleanup-resources``  - Identify or remove stale AWS resources.
* ``health-check``       - Probe HTTP endpoints, DNS, and TLS certificates.
"""

from __future__ import annotations

import json
import sys
from typing import Optional, Tuple

import click
from rich.console import Console
from rich.table import Table

from automation_toolkit import __version__
from automation_toolkit.aws import (
    find_untagged_resources,
    list_instances,
)
from automation_toolkit.health import check_dns, check_endpoint, check_ssl_cert_expiry
from automation_toolkit.logger import setup_logging

console = Console()


# ---------------------------------------------------------------------------
# Root group
# ---------------------------------------------------------------------------

@click.group()
@click.version_option(version=__version__, prog_name="automation-toolkit")
@click.option(
    "--log-level",
    type=click.Choice(["DEBUG", "INFO", "WARNING", "ERROR"], case_sensitive=False),
    default="INFO",
    help="Set logging verbosity.",
)
@click.option(
    "--log-format",
    type=click.Choice(["json", "text"], case_sensitive=False),
    default="json",
    help="Log output format.",
)
@click.pass_context
def main(ctx: click.Context, log_level: str, log_format: str) -> None:
    """Automation Toolkit -- modular cloud operations CLI."""
    setup_logging(level=log_level, fmt=log_format)
    ctx.ensure_object(dict)
    ctx.obj["log_level"] = log_level


# ---------------------------------------------------------------------------
# aws-inventory
# ---------------------------------------------------------------------------

@main.command("aws-inventory")
@click.option(
    "--region",
    default="us-east-1",
    show_default=True,
    help="AWS region to query.",
)
@click.option(
    "--output",
    "output_fmt",
    type=click.Choice(["table", "json"], case_sensitive=False),
    default="table",
    show_default=True,
    help="Output format.",
)
@click.option(
    "--state",
    "state_filter",
    default=None,
    help="Filter instances by state (e.g. running, stopped).",
)
def aws_inventory(region: str, output_fmt: str, state_filter: Optional[str]) -> None:
    """List EC2 instances in the specified region."""
    filters = []
    if state_filter:
        filters.append({"Name": "instance-state-name", "Values": [state_filter]})

    try:
        instances = list_instances(region=region, filters=filters or None)
    except Exception as exc:
        console.print(f"[red]Error:[/red] {exc}")
        sys.exit(1)

    if output_fmt == "json":
        click.echo(json.dumps(instances, indent=2, default=str))
        return

    table = Table(title=f"EC2 Instances - {region}")
    table.add_column("Instance ID", style="cyan")
    table.add_column("Type")
    table.add_column("State", style="green")
    table.add_column("Private IP")
    table.add_column("Name")

    for inst in instances:
        name = inst.get("Tags", {}).get("Name", "-")
        table.add_row(
            inst["InstanceId"],
            inst["InstanceType"],
            inst["State"],
            inst["PrivateIpAddress"] or "-",
            name,
        )

    console.print(table)


# ---------------------------------------------------------------------------
# cleanup-resources
# ---------------------------------------------------------------------------

@main.command("cleanup-resources")
@click.option(
    "--region",
    default="us-east-1",
    show_default=True,
    help="AWS region to scan.",
)
@click.option(
    "--required-tags",
    default="Name,Environment,Owner",
    show_default=True,
    help="Comma-separated list of required tag keys.",
)
@click.option(
    "--dry-run/--execute",
    default=True,
    show_default=True,
    help="Preview changes without applying them.",
)
def cleanup_resources(region: str, required_tags: str, dry_run: bool) -> None:
    """Find untagged resources and optionally apply default tags."""
    tag_keys = [t.strip() for t in required_tags.split(",") if t.strip()]

    try:
        untagged = find_untagged_resources(
            required_tags=tag_keys,
            region=region,
        )
    except Exception as exc:
        console.print(f"[red]Error:[/red] {exc}")
        sys.exit(1)

    if not untagged:
        console.print("[green]All instances have the required tags.[/green]")
        return

    table = Table(title="Untagged Resources")
    table.add_column("Instance ID", style="cyan")
    table.add_column("Missing Tags", style="red")

    for inst in untagged:
        table.add_row(
            inst["InstanceId"],
            ", ".join(inst.get("MissingTags", [])),
        )

    console.print(table)

    if dry_run:
        console.print(
            "\n[yellow]Dry-run mode:[/yellow] no changes applied. "
            "Re-run with --execute to apply tags."
        )
    else:
        console.print(
            "\n[bold red]Execute mode is not yet implemented in this release.[/bold red]"
        )


# ---------------------------------------------------------------------------
# health-check
# ---------------------------------------------------------------------------

@main.command("health-check")
@click.option(
    "--target",
    required=True,
    help="URL or hostname to check.",
)
@click.option(
    "--timeout",
    default=10,
    show_default=True,
    type=int,
    help="Request timeout in seconds.",
)
@click.option(
    "--checks",
    default="http,dns,ssl",
    show_default=True,
    help="Comma-separated check types to run: http, dns, ssl.",
)
def health_check(target: str, timeout: int, checks: str) -> None:
    """Run health-check probes against the specified target."""
    check_types = {c.strip().lower() for c in checks.split(",")}

    # Extract hostname from URL for DNS/SSL checks.
    hostname = target.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]

    results = []

    if "http" in check_types:
        url = target if target.startswith(("http://", "https://")) else f"https://{target}"
        result = check_endpoint(url=url, timeout=timeout)
        results.append(("HTTP", result))

    if "dns" in check_types:
        result = check_dns(hostname=hostname)
        results.append(("DNS", result))

    if "ssl" in check_types:
        result = check_ssl_cert_expiry(hostname=hostname)
        results.append(("SSL", result))

    table = Table(title=f"Health Check - {target}")
    table.add_column("Check", style="cyan")
    table.add_column("Status")
    table.add_column("Details")

    for label, res in results:
        status_style = "green" if res.get("healthy") else "red"
        table.add_row(
            label,
            f"[{status_style}]{res.get('status', 'unknown')}[/{status_style}]",
            res.get("detail", ""),
        )

    console.print(table)

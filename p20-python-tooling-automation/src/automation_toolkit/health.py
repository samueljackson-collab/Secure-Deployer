"""Health-check probes for HTTP endpoints, DNS resolution, and TLS certificates.

Every function returns a structured dictionary with at least the keys
``healthy`` (bool), ``status`` (str), and ``detail`` (str) so that callers
can aggregate and display results uniformly.
"""

from __future__ import annotations

import logging
import socket
import ssl
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests
from requests.exceptions import ConnectionError, RequestException, Timeout

logger = logging.getLogger(__name__)

# Type alias for the result dicts returned by every probe.
HealthResult = Dict[str, Any]


def check_endpoint(
    url: str,
    *,
    timeout: int = 10,
    expected_status: int = 200,
    method: str = "GET",
) -> HealthResult:
    """Send an HTTP request and evaluate the response.

    Parameters
    ----------
    url:
        Fully qualified URL (``https://example.com/health``).
    timeout:
        Request timeout in seconds.
    expected_status:
        HTTP status code that indicates a healthy response.
    method:
        HTTP method (``GET``, ``HEAD``, etc.).

    Returns
    -------
    HealthResult
    """
    result: HealthResult = {
        "check": "http",
        "target": url,
        "healthy": False,
        "status": "unknown",
        "detail": "",
    }

    try:
        response = requests.request(
            method=method.upper(),
            url=url,
            timeout=timeout,
            allow_redirects=True,
        )
        result["status_code"] = response.status_code
        result["response_time_ms"] = round(response.elapsed.total_seconds() * 1000, 2)

        if response.status_code == expected_status:
            result["healthy"] = True
            result["status"] = "healthy"
            result["detail"] = (
                f"{response.status_code} in {result['response_time_ms']}ms"
            )
        else:
            result["status"] = "unhealthy"
            result["detail"] = (
                f"Expected {expected_status}, got {response.status_code}"
            )

    except Timeout:
        result["status"] = "timeout"
        result["detail"] = f"Request timed out after {timeout}s"
        logger.warning("HTTP timeout for %s", url)
    except ConnectionError as exc:
        result["status"] = "connection_error"
        result["detail"] = f"Connection failed: {exc}"
        logger.warning("HTTP connection error for %s: %s", url, exc)
    except RequestException as exc:
        result["status"] = "error"
        result["detail"] = str(exc)
        logger.error("HTTP request error for %s: %s", url, exc)

    return result


def check_dns(
    hostname: str,
    *,
    record_type: str = "A",
) -> HealthResult:
    """Resolve a hostname and return the result.

    Parameters
    ----------
    hostname:
        Hostname to resolve (e.g. ``example.com``).
    record_type:
        DNS record type hint.  Currently only ``A`` (IPv4) is implemented via
        :func:`socket.getaddrinfo`.

    Returns
    -------
    HealthResult
    """
    result: HealthResult = {
        "check": "dns",
        "target": hostname,
        "healthy": False,
        "status": "unknown",
        "detail": "",
    }

    try:
        addr_infos = socket.getaddrinfo(
            hostname, None, socket.AF_INET, socket.SOCK_STREAM
        )
        addresses = sorted({info[4][0] for info in addr_infos})

        if addresses:
            result["healthy"] = True
            result["status"] = "resolved"
            result["addresses"] = addresses
            result["detail"] = f"Resolved to {', '.join(addresses)}"
        else:
            result["status"] = "no_records"
            result["detail"] = "DNS query returned no A records"

    except socket.gaierror as exc:
        result["status"] = "resolution_failed"
        result["detail"] = f"DNS resolution failed: {exc}"
        logger.warning("DNS resolution failed for %s: %s", hostname, exc)
    except OSError as exc:
        result["status"] = "error"
        result["detail"] = str(exc)
        logger.error("DNS check error for %s: %s", hostname, exc)

    return result


def check_ssl_cert_expiry(
    hostname: str,
    *,
    port: int = 443,
    warning_days: int = 30,
) -> HealthResult:
    """Connect to *hostname* over TLS and check certificate expiry.

    Parameters
    ----------
    hostname:
        Hostname whose TLS certificate should be inspected.
    port:
        TCP port for the TLS connection.
    warning_days:
        Number of days before expiry at which the result is flagged
        as ``warning`` instead of ``healthy``.

    Returns
    -------
    HealthResult
    """
    result: HealthResult = {
        "check": "ssl",
        "target": f"{hostname}:{port}",
        "healthy": False,
        "status": "unknown",
        "detail": "",
    }

    ctx = ssl.create_default_context()

    try:
        with socket.create_connection((hostname, port), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as tls_sock:
                cert = tls_sock.getpeercert()

        if cert is None:
            result["status"] = "no_certificate"
            result["detail"] = "Peer did not present a certificate"
            return result

        not_after_str = cert.get("notAfter", "")
        if not not_after_str:
            result["status"] = "invalid_certificate"
            result["detail"] = "Certificate has no notAfter field"
            return result

        # Parse the OpenSSL date format: 'MMM DD HH:MM:SS YYYY GMT'
        not_after = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(
            tzinfo=timezone.utc
        )
        now = datetime.now(timezone.utc)
        days_remaining = (not_after - now).days

        result["expires"] = not_after.isoformat()
        result["days_remaining"] = days_remaining

        if days_remaining < 0:
            result["status"] = "expired"
            result["detail"] = f"Certificate expired {abs(days_remaining)} day(s) ago"
        elif days_remaining <= warning_days:
            result["healthy"] = True
            result["status"] = "warning"
            result["detail"] = f"Certificate expires in {days_remaining} day(s)"
        else:
            result["healthy"] = True
            result["status"] = "healthy"
            result["detail"] = f"Certificate valid for {days_remaining} day(s)"

    except ssl.SSLCertVerificationError as exc:
        result["status"] = "verification_failed"
        result["detail"] = f"Certificate verification failed: {exc}"
        logger.warning("SSL verification failed for %s: %s", hostname, exc)
    except (socket.timeout, OSError) as exc:
        result["status"] = "connection_error"
        result["detail"] = f"Could not connect: {exc}"
        logger.warning("SSL connection error for %s: %s", hostname, exc)

    return result

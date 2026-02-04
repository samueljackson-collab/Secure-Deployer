"""Unit tests for automation_toolkit.health using unittest.mock."""

from __future__ import annotations

import datetime
import socket
import ssl
from unittest import mock

import pytest
import requests

from automation_toolkit.health import (
    check_dns,
    check_endpoint,
    check_ssl_cert_expiry,
)


# -----------------------------------------------------------------------
# check_endpoint
# -----------------------------------------------------------------------


class TestCheckEndpoint:
    """Tests for check_endpoint()."""

    @mock.patch("automation_toolkit.health.requests.request")
    def test_healthy_endpoint(self, mock_request):
        """A 200 response should produce a healthy result."""
        mock_response = mock.MagicMock()
        mock_response.status_code = 200
        mock_response.elapsed = datetime.timedelta(milliseconds=42)
        mock_request.return_value = mock_response

        result = check_endpoint("https://example.com/health")

        assert result["healthy"] is True
        assert result["status"] == "healthy"
        assert result["status_code"] == 200
        assert result["response_time_ms"] == 42.0

    @mock.patch("automation_toolkit.health.requests.request")
    def test_unexpected_status_code(self, mock_request):
        """A non-200 response should be marked unhealthy."""
        mock_response = mock.MagicMock()
        mock_response.status_code = 503
        mock_response.elapsed = datetime.timedelta(milliseconds=10)
        mock_request.return_value = mock_response

        result = check_endpoint("https://example.com/health")

        assert result["healthy"] is False
        assert result["status"] == "unhealthy"
        assert "503" in result["detail"]

    @mock.patch("automation_toolkit.health.requests.request")
    def test_custom_expected_status(self, mock_request):
        """Callers can specify a custom expected status code."""
        mock_response = mock.MagicMock()
        mock_response.status_code = 204
        mock_response.elapsed = datetime.timedelta(milliseconds=5)
        mock_request.return_value = mock_response

        result = check_endpoint(
            "https://example.com/ping",
            expected_status=204,
        )

        assert result["healthy"] is True
        assert result["status_code"] == 204

    @mock.patch("automation_toolkit.health.requests.request")
    def test_timeout_handling(self, mock_request):
        """A timeout should be reported clearly."""
        mock_request.side_effect = requests.exceptions.Timeout("timed out")

        result = check_endpoint("https://example.com/slow", timeout=5)

        assert result["healthy"] is False
        assert result["status"] == "timeout"
        assert "5s" in result["detail"]

    @mock.patch("automation_toolkit.health.requests.request")
    def test_connection_error_handling(self, mock_request):
        """A connection error should set the appropriate status."""
        mock_request.side_effect = requests.exceptions.ConnectionError(
            "Connection refused"
        )

        result = check_endpoint("https://down.example.com")

        assert result["healthy"] is False
        assert result["status"] == "connection_error"


# -----------------------------------------------------------------------
# check_dns
# -----------------------------------------------------------------------


class TestCheckDns:
    """Tests for check_dns()."""

    @mock.patch("automation_toolkit.health.socket.getaddrinfo")
    def test_successful_resolution(self, mock_getaddrinfo):
        """A hostname that resolves should produce a healthy result."""
        mock_getaddrinfo.return_value = [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0)),
        ]

        result = check_dns("example.com")

        assert result["healthy"] is True
        assert result["status"] == "resolved"
        assert "93.184.216.34" in result["addresses"]

    @mock.patch("automation_toolkit.health.socket.getaddrinfo")
    def test_resolution_failure(self, mock_getaddrinfo):
        """A hostname that fails to resolve should be flagged."""
        mock_getaddrinfo.side_effect = socket.gaierror("Name or service not known")

        result = check_dns("nonexistent.invalid")

        assert result["healthy"] is False
        assert result["status"] == "resolution_failed"

    @mock.patch("automation_toolkit.health.socket.getaddrinfo")
    def test_empty_result(self, mock_getaddrinfo):
        """An empty address list should report no_records."""
        mock_getaddrinfo.return_value = []

        result = check_dns("empty.example.com")

        assert result["healthy"] is False
        assert result["status"] == "no_records"


# -----------------------------------------------------------------------
# check_ssl_cert_expiry
# -----------------------------------------------------------------------


class TestCheckSslCertExpiry:
    """Tests for check_ssl_cert_expiry()."""

    def _mock_tls_connection(self, not_after_str: str):
        """Return nested context-manager mocks simulating a TLS handshake."""
        mock_cert = {"notAfter": not_after_str}

        mock_tls_sock = mock.MagicMock()
        mock_tls_sock.getpeercert.return_value = mock_cert

        mock_ssl_ctx = mock.MagicMock()
        mock_ssl_ctx.wrap_socket.return_value.__enter__ = mock.MagicMock(
            return_value=mock_tls_sock
        )
        mock_ssl_ctx.wrap_socket.return_value.__exit__ = mock.MagicMock(
            return_value=False
        )

        mock_sock = mock.MagicMock()
        return mock_sock, mock_ssl_ctx

    @mock.patch("automation_toolkit.health.ssl.create_default_context")
    @mock.patch("automation_toolkit.health.socket.create_connection")
    def test_healthy_certificate(self, mock_conn, mock_ssl_ctx_factory):
        """A certificate valid for many days should be healthy."""
        future = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365)
        not_after = future.strftime("%b %d %H:%M:%S %Y GMT")

        mock_sock, mock_ssl_ctx = self._mock_tls_connection(not_after)
        mock_conn.return_value.__enter__ = mock.MagicMock(return_value=mock_sock)
        mock_conn.return_value.__exit__ = mock.MagicMock(return_value=False)
        mock_ssl_ctx_factory.return_value = mock_ssl_ctx

        result = check_ssl_cert_expiry("example.com")

        assert result["healthy"] is True
        assert result["status"] == "healthy"
        assert result["days_remaining"] > 300

    @mock.patch("automation_toolkit.health.ssl.create_default_context")
    @mock.patch("automation_toolkit.health.socket.create_connection")
    def test_expiring_soon_certificate(self, mock_conn, mock_ssl_ctx_factory):
        """A certificate expiring within warning_days should get a warning."""
        future = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=15)
        not_after = future.strftime("%b %d %H:%M:%S %Y GMT")

        mock_sock, mock_ssl_ctx = self._mock_tls_connection(not_after)
        mock_conn.return_value.__enter__ = mock.MagicMock(return_value=mock_sock)
        mock_conn.return_value.__exit__ = mock.MagicMock(return_value=False)
        mock_ssl_ctx_factory.return_value = mock_ssl_ctx

        result = check_ssl_cert_expiry("example.com", warning_days=30)

        assert result["healthy"] is True
        assert result["status"] == "warning"

    @mock.patch("automation_toolkit.health.ssl.create_default_context")
    @mock.patch("automation_toolkit.health.socket.create_connection")
    def test_connection_error(self, mock_conn, mock_ssl_ctx_factory):
        """A connection failure should be reported."""
        mock_conn.side_effect = OSError("Connection refused")

        result = check_ssl_cert_expiry("unreachable.example.com")

        assert result["healthy"] is False
        assert result["status"] == "connection_error"

"""Outbound URL policy for user-supplied LLM endpoints (SSRF guard).

The settings probe and the saved generation/embedding URLs are fetched
server-side, so an authenticated user controls the request target. Without a
policy this is an SSRF primitive: a hosted deployment could be pointed at a
cloud metadata service, a loopback admin port, or an internal host — and the
probe even reflects response snippets back to the caller.

Policy:
- Link-local / cloud-metadata ranges (169.254.0.0/16, fe80::/10, etc.) are
  ALWAYS blocked — never a legitimate LLM endpoint, highest-value target.
- Loopback and private ranges are allowed by default, because EchoVault's
  headline use case is a local Ollama (localhost / host.docker.internal /
  LAN). Operators of hosted, multi-user deployments set RESTRICT_LLM_ENDPOINTS
  (config ``restrict_llm_endpoints``) to block these too, leaving only public
  hosts.

Every address a hostname resolves to is checked, so a public name that
resolves to an internal IP is rejected. This narrows but does not fully close
DNS rebinding (the address at fetch time may differ from the one validated
here); it is a pragmatic mitigation, not a network sandbox.

Only *user-supplied* URLs are validated. Server defaults
(``DEFAULT_GENERATION_URL`` / ``DEFAULT_EMBEDDING_URL``) are operator-chosen
and trusted, so callers pass them straight through.
"""
import asyncio
import ipaddress
import socket
from typing import Optional
from urllib.parse import urlparse

from app.core.config import settings as app_settings


class OutboundPolicyError(Exception):
    """Raised when a user-supplied URL targets a disallowed network."""


def _classify_blocked(ip: ipaddress._BaseAddress) -> Optional[str]:
    """Return a human-readable reason if ``ip`` is disallowed, else None."""
    # IPv4-mapped IPv6 (::ffff:a.b.c.d) — unwrap so the v4 rules apply.
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        return _classify_blocked(mapped)

    # Always blocked, regardless of restrict_llm_endpoints: never a legitimate
    # LLM endpoint. Link-local covers the cloud-metadata service (169.254/16).
    if ip.is_link_local:
        return "link-local/metadata"
    if ip.is_multicast:
        return "multicast"
    if ip.is_unspecified:
        return "unspecified"

    # Loopback / private: allowed unless the deployment restricts endpoints.
    # Checked before the generic "reserved" rule because some loopback
    # addresses (notably IPv6 ::1) are also flagged reserved — and the local
    # Ollama case (localhost → ::1 / 127.0.0.1) must stay allowed by default.
    if ip.is_loopback or ip.is_private:
        return "loopback/private" if app_settings.restrict_llm_endpoints else None

    if ip.is_reserved:
        return "reserved"
    return None


async def validate_llm_url(url: str) -> None:
    """Validate that ``url`` is an allowed outbound LLM target.

    Resolves the host and rejects the request if any resolved address violates
    the outbound policy. Raises :class:`OutboundPolicyError` on violation or if
    the host cannot be resolved.
    """
    parsed = urlparse(url)
    host = parsed.hostname
    if not host:
        raise OutboundPolicyError("The URL has no host.")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    # getaddrinfo can block (DNS); run it on the event loop's resolver so the
    # async endpoint isn't stalled.
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise OutboundPolicyError(
            f"Could not resolve the endpoint host '{host}'."
        ) from exc

    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        reason = _classify_blocked(ip)
        if reason:
            raise OutboundPolicyError(
                f"The endpoint host '{host}' resolves to a disallowed "
                f"{reason} address and cannot be reached for security reasons."
            )

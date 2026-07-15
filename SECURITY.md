# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x | ✅ Active |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report via [GitHub Security Advisory](https://github.com/stellar-sharpy/sharpy-sdk/security/advisories/new) or contact the maintainers directly.

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected SDK method(s)
- Potential impact

We will acknowledge within 48 hours and aim to release a fix within 7 days.

## Scope

- Private key or secret key exposure
- Transaction signing vulnerabilities
- Incorrect amount parsing (`parseAmount` / `formatAmount`)
- Auth entry manipulation in x402 or wallet flows

## Out of Scope

- Stellar network-level issues
- Third-party wallet vulnerabilities

## Disclosure Policy

We follow coordinated disclosure. Please give us reasonable time to patch before public disclosure.

# Security Policy

## Supported Versions

Security updates and patches are applied to the latest stable release.

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | Yes                |
| 1.x     | No                 |

---

## Security Model & Guarantees

AIStat is designed with a strict local-first, zero-knowledge architecture:

- **Local Storage Isolation**: All prompt counts, hourly breakdowns, and settings are stored locally in the browser's sandbox using `chrome.storage.local`.
- **Zero Cloud Exfiltration**: No APIs, analytics endpoints, or remote logging services are contacted.
- **Minimal Permissions**: The extension requests only the required permissions (`storage`, `alarms`, and targeted AI host domains) needed to function without broad `all_urls` access.
- **Content Security Policy**: No inline eval or remote script loading is permitted.

---

## Reporting a Vulnerability

If you discover a security vulnerability or privacy violation within AIStat, please report it responsibly:

1. Do not create a public GitHub issue for sensitive security vulnerabilities.
2. Email security vulnerability details directly to the project maintainer or submit via GitHub Private Vulnerability Reporting.
3. Include detailed steps to reproduce the issue, along with browser version and extension release information.
4. Reports will be acknowledged within 48 hours, and a coordinated fix will be prepared promptly.

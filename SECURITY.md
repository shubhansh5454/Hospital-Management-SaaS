# Hospital ERP SaaS - Security Policy & Architecture

## 1. Threat Mitigation Strategies

### 1.1 Broken Object Level Authorization (BOLA)
BOLA is the most critical threat in multi-tenant environments.
- **Remediation**: All EMR, laboratory, billing, and radiology operations check clinic context relations. If a clinician requests data with an ID that belongs to a different clinic, the system responds with a silent `404 Not Found` rather than a `403 Forbidden` to prevent resource harvesting/existence disclosure.

### 1.2 Cross-Site Scripting (XSS)
- **Remediation**: Standardized `xssSanitizer` middleware runs recursively on all incoming request bodies, query parameters, and route parameters. Dangerous tags like `<script>`, dynamic onload handlers (`onerror`, `onload`), and inline `javascript:` URIs are neutralized safely.

### 1.3 SQL Injection (SQLi)
- **Remediation**: The primary relational access relies on Prisma's parameterized queries. Supplementary search features employ an active SQLi regex engine to block dynamic payload vectors (e.g. `OR 1=1`, `UNION ALL SELECT`).

### 1.4 CSRF (Cross-Site Request Forgery)
- **Remediation**: CSRF protection middleware blocks non-idempotent HTTP methods (`POST`, `PUT`, `DELETE`) originating from untrusted referrers/origins, enforcing match constraints against the validated server host.

### 1.5 Secure Transport & Embedding
- **HSTS**: Strict-Transport-Security header locks TLS usage in browser targets.
- **CSP**: Robust Content Security Policy blocking unauthorized inline scripts while supporting sandboxed rendering (such as safe print previews via embedded iFrames).
- **Frame Ancestors**: Constrains embedding targets exclusively to approved host domains like Google AI Studio.

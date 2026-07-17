# Technical Debt Registry

This document logs identified tech debt, performance bottlenecks, and architectural trade-offs within the Hospital ERP SaaS codebase, along with remediation pathways.

## 1. Local Store JSON Files for SaaS Scheduled Reports
*   **Description:** `LocalStoreService` utilizes standard synchronously-written JSON files on the local process disk for scheduled reports, backup historical listings, and system preferences.
*   **Impact:** Fine for high-efficiency prototypes, but limits horizontal scaling across multiple container instances since local files are isolated to each pod's container.
*   **Remediation:** Migrating these tables directly to core PostgreSQL schemas using Prisma so they are shared across all app replicas in high-availability clusters.

## 2. Mock Multi-Category Financial Aggregates in BI Endpoints
*   **Description:** Part of the monthly consultation/pharmacy revenues trend in `/api/bi/revenue-analytics` is hardcoded as high-fidelity aggregates instead of performing live multi-table SQL queries.
*   **Impact:** Low operational impact, but reports do not update dynamically when new invoice payments are registered during that exact session.
*   **Remediation:** Convert mock trends to a performant raw PostgreSQL date-trunc aggregate query utilizing Redis cache layer.

## 3. UI Chart Loading Delays on Low-Spec Workstations
*   **Description:** The BI dashboard fetches and renders all Recharts modules (overview, doctors, patients, inventory) concurrently, causing rendering overhead.
*   **Impact:** Potential lag/flicker during initial load on weak browsers.
*   **Remediation:** Implement lazy rendering of charts, so they only mount and render when their parent tab is active.

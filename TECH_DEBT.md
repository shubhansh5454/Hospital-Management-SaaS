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

## 4. Public CDN Dependency in Clinical Document (C-CDA) Printing
*   **Description:** The print layout generated for the C-CDA clinical summary imports the Tailwind CSS framework dynamically from a public CDN (`cdn.tailwindcss.com`) in the print window's iframe.
*   **Impact:** In network-isolated, HIPAA-hardened, or strict clinical intranet firewalls common in enterprise hospital groups, the print-out preview might fail to render custom layout structures if outside domains are blocked.
*   **Remediation:** Inline a self-contained, pre-compiled structural print stylesheet directly in the HTML compiler instead of relying on external scripts.

## 5. Completed Reviews & Safe Defences (Refined July 2026)
*   **Calendar Scheduling Concurrency Race Conditions**: Resolved. Hardened the appointment creation and modification pipeline to prevent schedule clashing under simultaneous operations. Implemented database transactions with `Serializable` isolation level, validated by integration test Suite 10.
*   **Asynchronous State Race Conditions**: Resolved. Addressed potential asynchronous state race conditions in `Patients.tsx` where clinical export records may be triggered on undefined/changing states, securing client-server state continuity.
*   **Radiology PACS BOLA Vulnerability**: Resolved. Hardened the imaging order pipeline to prevent cross-tenant security issues. Fully parameterized all controller, service, and repository layers to enforce clinic-level logical tenant isolation checks, validated by integration test Suite 8.
*   **Laboratory BOLA Vulnerability**: Resolved. Hardened the laboratory order, sample tracking, and metrics pipeline to guarantee logical multi-tenant isolation. Fully parameterized all layers with clinic-level tenant validations, validated by integration test Suite 9.


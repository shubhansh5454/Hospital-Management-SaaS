# Definition of Done (DoD) - Hospital ERP SaaS

This document outlines the strict quality gating standards required for every feature, bug fix, or technical improvement before it can be merged into production or marked as **Done** in the `PRODUCT_BACKLOG.md`.

---

## 1. Code Quality & Architecture
- [ ] **Successful Build**: The application compiles successfully in all environments with `npm run build` and `npm run dev` with no runtime errors.
- [ ] **TypeScript Type Safety**: All files are strictly typed. There are no TypeScript compiler warnings, explicit/implicit `any` overrides, or missing type bindings.
- [ ] **Lint Cleanliness**: Running `npm run lint` yields zero errors and zero warnings. Code formatting is uniform.
- [ ] **Dry & Modular Code**: No duplicate business or UI logic. Large views are refactored into modular sub-components to prevent file token clipping.
- [ ] **Clean Architecture**: Follows the separation of concerns:
  - **Controllers**: Handle HTTP parsing, payload validation, and responses.
  - **Services**: Coordinate business logic, enforce domain boundaries, and manage transaction scopes.
  - **Repositories**: Execute database queries using Prisma ORM. No raw queries unless strictly parameterized.
- [ ] **SOLID Principles**: Single responsibility, open-closed, Liskov substitution, interface segregation, and dependency inversion principles are strictly followed.

---

## 2. Security & Compliance (HIPAA / GDPR Ready)
- [ ] **BOLA Protection & Logical Multi-Tenancy**: Every database retrieval, modification, or action verifies that the entity belongs to the active clinic context (`clinicId === req.user.clinicId`). Unauthorized cross-tenant queries return a clean `404 Not Found`.
- [ ] **Authentication & Session Security**: Sensitive clinical routes are guarded behind JWT verification, serving secure, HTTP-Only, SameSite cookies.
- [ ] **Strict Role-Based Access Control (RBAC)**: Least privilege access is verified (e.g., Patient records are only visible to physicians/receptionists of the matching tenant, and editing is locked appropriately).
- [ ] **XSS & Script Injection Defense**: All user inputs (especially clinical notes and patient demographics) pass through strict sanitization, recursively stripping executable or dynamic tags (e.g., `<script>`, `onload`, `javascript:` protocols).
- [ ] **CSRF Defense**: State-changing API actions (POST, PUT, DELETE) block untrusted origin and referer domain headers.
- [ ] **Input & Payload Validation**: All incoming requests are strictly checked against robust schema validations (e.g., Zod) in the controller layer before hitting services.
- [ ] **Zero Hardcoded Secrets**: Secrets, credentials, and API keys are stored exclusively as environment variables, with templates provided in `.env.example`.

---

## 3. Database Integrity
- [ ] **Schema & Migrations**: Schema updates are defined in `prisma/schema.prisma` and translated into clean database migrations.
- [ ] **Query Indexes**: High-frequency filter keys (e.g., `clinicId`, `patientId`, `doctorId`, `status`) are indexed to maintain sub-second retrieval times.
- [ ] **Atomic Transactions**: Multi-step state updates (such as appointment bookings or financial ledger balances) run inside database transaction locks (`prisma.$transaction`) with appropriate isolation levels (e.g., `Serializable` for double-booking prevention) to avoid race conditions.

---

## 4. API Design Standards
- [ ] **Consistent Response Structure**: All API endpoints return uniform JSON objects.
- [ ] **HTTP Status Codes**: Clean use of standard HTTP status codes:
  - `200 OK` / `201 Created` for successful operations.
  - `400 Bad Request` for validation or concurrent transaction conflicts.
  - `401 Unauthorized` / `403 Forbidden` for identity and access issues.
  - `404 Not Found` for missing resources or mismatched tenant isolation blocks (BOLA prevention).
- [ ] **Search & Filtering**: Clinical tables provide clean pagination, sorting, and search querying parameters.

---

## 5. Frontend & UI Polish
- [ ] **Aesthetic Pairings & Polish**: Typography matches the designated display fonts. Spacing avoids default/robot layout patterns and respects negative space.
- [ ] **Responsive Visual Design**: Interfaces are adaptive, fluidly resizing from mobile targets to widescreen monitors. Touch targets on mobile are at least 44px.
- [ ] **UX States**: Every dynamic component features clean loading states, graceful empty states, error-handling boundary states, and detailed client-side form validation indicators.
- [ ] **No Telemetry Clutter**: No system debugging information, telemetry counters, ping rates, or "online" indicators in margins unless explicitly requested by the product team.
- [ ] **Contrast & Accessibility**: Renders readable text over safe, high-contrast backgrounds.

---

## 6. Testing Gating
- [ ] **Automated Regression Coverage**: New features have corresponding tests integrated into `/tests/runner.ts`.
- [ ] **Zero Regressions**: Running `npm test` completes successfully with a **100% pass rate** across all automated test suites.
- [ ] **High-Risk Path Verification**: Edge cases, concurrent requests, race conditions, and malicious security payload patterns (XSS, SQL injection, BOLA) are validated.

---

## 7. Documentation & Logs
- [ ] **Changelog Tracking**: Every change is logged under a semantically versioned release header inside `CHANGELOG.md`.
- [ ] **Tech Debt Tracking**: Any identified structural code quality issues or compromises are listed inside `TECH_DEBT.md`.
- [ ] **Test Plan Maintenance**: Verification scenarios and test suites are synchronized inside `TEST_PLAN.md`.
- [ ] **Backlog Synchronization**: Backlog item status is updated in `PRODUCT_BACKLOG.md` upon completion.

---

## 8. Performance & Optimization
- [ ] **Avoid React Re-renders**: State updates do not create infinite re-rendering loops. Avoid passing raw objects, arrays, or functions inside hook dependencies unless deeply memoized.
- [ ] **Optimized Queries**: Prisma includes statements are limited to the exact relation paths required, preventing deep N+1 database querying bugs.

---

## 9. Deployment Readiness
- [ ] **Configuration Documentation**: All newly introduced environment variables are declared in `.env.example`.
- [ ] **Production Health Check**: Serving endpoints successfully respond to `/api/health` indicators.

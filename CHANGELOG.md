# Changelog

All notable changes to the Hospital ERP SaaS project will be documented in this file.

## [2.4.0] - 2026-07-17
### Added
- **Calendar Double-Booking Protection**: Implemented strict high-isolation database transaction locks (`Serializable` level) wrapping both appointment creation and schedule modifications.
- **Suite 10 Integration Test Suite**: Developed an automated integration test suite in `tests/runner.ts` confirming that simultaneous overlapping bookings are strictly serialized, and write conflict serialization failures (Prisma code `P2034`) are gracefully mapped to user-friendly warnings.

### Changed
- **Transaction-Aware Repositories**: Modified `AppointmentRepository` (`create`, `update`, `checkOverlap` methods) to support execution context forwarding for atomic database clients (`tx`).
- **Transactional Appointment Services**: Refactored `AppointmentService` to handle concurrency conflicts gracefully, throwing mapped `400` errors upon concurrent slot competition.

## [2.3.0] - 2026-07-17
### Added
- **Laboratory Multi-Tenant Isolation (BOLA Protection)**: Implemented strict clinic-level logical tenant isolation checks across the Laboratory and sample processing pipelines.
- **Suite 9 Regression Test Suite**: Integrated an automated integration test suite in `tests/runner.ts` confirming that cross-clinic booking, retrieval, sample collection, and metrics requests are strictly blocked with secure 404/400 errors.

### Changed
- **Secure Laboratory Controllers**: Enhanced all handlers in `/src/server/controllers/lab.ts` to extract `clinicId` from the request session and propagate it down the call stack.
- **Tenant-Aware Lab Services**: Refactored `/src/server/services/lab.ts` to enforce tenant validation on booking, listing, retrieving, and processing laboratory orders.
- **Isolated Lab Repositories**: Modified `/src/server/repositories/lab.ts` to scope database records, count queries, and dashboard KPI metrics exclusively to the client's clinic ID.

## [2.2.0] - 2026-07-17
### Added
- **Radiology Multi-Tenant Isolation (BOLA Protection)**: Added strict clinic-level logical tenant isolation checks across the Radiology and PACS integration pipelines.
- **Suite 8 Regression Test Suite**: Added a robust, automated async integration test suite in `tests/runner.ts` validating successful intra-clinic orders and secure 404 blockages for cross-clinic imaging order manipulations.
- **Unified ERP System Documentation**: Provisioned and documented complete, industry-standard SaaS operational archives including `PROJECT_VISION.md`, `PRODUCT_REQUIREMENTS.md`, `PRODUCT_ROADMAP.md`, `SPRINT_BACKLOG.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md`, and `SECURITY.md` files.

### Changed
- **Secure Radiology Controllers**: Modified all methods in `/src/server/controllers/radiology.ts` to extract the caller's session `clinicId` and enforce authorization down the logic stack.
- **Safe Radiology Repositories**: Enhanced database query filtering in `/src/server/repositories/radiology.ts` to restrict order queries to patient.clinicId scopes matching the request origin.
- **Improved Radiology Services**: Parameterized all CRUD and state-machine transitions in `/src/server/services/radiology.ts` to block unauthorized read/write access.

## [2.1.0] - 2026-07-17
### Added
- **Interoperability & Data Portability Engine**: Built backend FHIR (Fast Healthcare Interoperability Resources) R4 JSON bundle generation and high-fidelity CCDA HTML report summarization for complete patient clinical histories.
- **Patient Record Export UI**: Created an interactive export, download, and print dashboard under the Patients screen with JSON and CCDA tabs.
- **Automated Interoperability Tests**: Added test Suite 7 checking clinical data mapping, demographics formatting, encounter/EMR relationships, and 404 error responses.

### Changed
- **Sandbox-Compatible Printing**: Refactored C-CDA printing logic in the frontend Patients modal to use a dynamic, hidden iframe print flow, avoiding popup blocks inside standard iframe embedding.
- **Backlog Management**: Initialized and updated `/PROJECT_BACKLOG.md`, `/ARCHITECTURE_DECISIONS.md`, `/CHANGELOG.md`, and `/TECH_DEBT.md` records.
- **Robust Clinical Export Handlers**: Added optional chaining and safe string-slug fallbacks in frontend print and download triggers during post-implementation architectural code review to prevent asynchronous state inconsistencies.

## [2.0.0] - Previous Sessions
### Added
- **Business Intelligence Module**: Recharts-powered corporate dashboard with occupancy indicators, automated report scheduler, and revenue breakdowns.
- **Durable Event-Driven Architecture**: Fully-integrated in-memory Event Bus featuring idempotency keys, exponential backoff, retry loops, and Dead Letter Queue (DLQ).
- **Automated Backup & Restore Engine**: Built multi-provider backup utility supporting local disk, GCS, S3, and SFTP configurations.
- **Intelligent Clinical Decision Support**: Real-time allergy, prescription, and diagnosis warnings using the new `@google/genai` model.

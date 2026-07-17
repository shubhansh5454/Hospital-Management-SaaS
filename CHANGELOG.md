# Changelog

All notable changes to the Hospital ERP SaaS project will be documented in this file.

## [2.1.0] - 2026-07-17
### Added
- **Interoperability & Data Portability Engine**: Built backend FHIR (Fast Healthcare Interoperability Resources) R4 JSON bundle generation and high-fidelity CCDA HTML report summarization for complete patient clinical histories.
- **Patient Record Export UI**: Created an interactive export, download, and print dashboard under the Patients screen with JSON and CCDA tabs.

### Changed
- **Backlog Management**: Initialized and updated `/PROJECT_BACKLOG.md`, `/ARCHITECTURE_DECISIONS.md`, `/CHANGELOG.md`, and `/TECH_DEBT.md` records.

## [2.0.0] - Previous Sessions
### Added
- **Business Intelligence Module**: Recharts-powered corporate dashboard with occupancy indicators, automated report scheduler, and revenue breakdowns.
- **Durable Event-Driven Architecture**: Fully-integrated in-memory Event Bus featuring idempotency keys, exponential backoff, retry loops, and Dead Letter Queue (DLQ).
- **Automated Backup & Restore Engine**: Built multi-provider backup utility supporting local disk, GCS, S3, and SFTP configurations.
- **Intelligent Clinical Decision Support**: Real-time allergy, prescription, and diagnosis warnings using the new `@google/genai` model.

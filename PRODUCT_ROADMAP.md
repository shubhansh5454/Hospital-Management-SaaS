# Hospital ERP SaaS - Product Roadmap

## Phase 1: Core SaaS Foundations (Completed)
- Multi-tenant clinic onboarding and tenant subdomains.
- Custom RBAC with role-permission mappings.
- Basic scheduling, user accounts, and patient profiles.

## Phase 2: Interoperable EMR & CDS (Completed)
- Structured EMR entries (vitals, SOAP notes, e-prescriptions).
- HL7 FHIR R4 JSON bundles and CCDA summary generators.
- Gemini-powered differential diagnosis and allergen cross-matching.

## Phase 3: Clinical Ancillaries & Intelligence (Completed)
- Unified lab test bookings, sample barcodes, and validation.
- Inventory category products, SKU management, and stock alerts.
- Business Intelligence (BI) revenue growth, bed occupancy, and automated reports.

## Phase 4: Enterprise Security & BOLA Hardening (Current Milestone)
- **Radiology Module BOLA Prevention**: Refactored the imaging order PACS pipeline to enforce strict `clinicId` checks on create, retrieve, write report, and sign-off commands.
- **Suite 8 Integration Testing**: Added async regression test suites asserting that multi-clinic accounts cannot access, leak, or override each other's radiology scans.

## Phase 5: Global Commercialization (Future Q3-Q4 2026)
- Integration with external HL7 interfaces (Mirth Connect, Redox).
- Telemetry logging export adapters for enterprise hospital SIEM tools (Splunk, Datadog).
- Electronic claims processing and clearinghouse integrations (Change Healthcare).

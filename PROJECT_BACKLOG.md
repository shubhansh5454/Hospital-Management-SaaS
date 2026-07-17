# Hospital ERP SaaS Project Backlog

## Epic 1: Multi-Tenant Architecture & Modular Gateways
*   **Feature: Subdomain Routing & Instance Isolated Contexts**
    *   *User Story:* As a SaaS provider, I want to route requests to isolated clinic instances based on subdomain slugs so that tenants have full data privacy.
    *   *Task:* Implement middleware slug isolation with fallback to global host. (Priority: High | Status: COMPLETED | Dependencies: None)
*   **Feature: Feature Flag System & Plan Controls**
    *   *User Story:* As a superadmin, I want to toggle features globally and define subscription plan feature levels so that we can upsell premium features.
    *   *Task:* Add FeatureFlag database schemas, API routes, and client-side feature checking providers. (Priority: High | Status: COMPLETED | Dependencies: None)

## Epic 2: Advanced Electronic Medical Records (EMR)
*   **Feature: SOAP Notes & Structured Prescriptions**
    *   *User Story:* As a clinician, I want to log SOAP notes (Subjective, Objective, Assessment, Plan) and write structured, electronic prescriptions.
    *   *Task:* Add structured vitals fields, prescriptions JSON array, and attachment support in Prisma `EmrRecord`. (Priority: High | Status: COMPLETED | Dependencies: None)
*   **Feature: Enterprise Data Interoperability & Medical Compliance**
    *   *User Story:* As a clinical director, I want to export full patient histories into standard **HL7 FHIR R4 JSON bundles** or **CCDA summaries** to comply with HIPAA inter-operator data transfer laws.
    *   *Task:* Build backend export service, register `/api/patients/:id/export` routes, and create a high-fidelity Patient Record Export UI tab under Patients screen. (Priority: Critical | Status: COMPLETED | Dependencies: Epic 2 core)

## Epic 3: Smart Clinical Decision Support (CDS)
*   **Feature: Gemini-Powered Differential Diagnosis & Drug-Drug Interactions**
    *   *User Story:* As a doctor, I want real-time AI warnings on allergy overlaps, pediatric dose boundaries, and drug interaction risks when saving EMRs.
    *   *Task:* Integrate `@google/genai` on server-side with rich markdown explainability rendering. (Priority: High | Status: COMPLETED | Dependencies: Epic 2 SOAP)

## Epic 4: Event-Driven Enterprise Architecture
*   **Feature: Durable Domain Event Bus**
    *   *User Story:* As a systems architect, I want core service mutations (Billing, Appointments, EMR) to publish domain events to a local bus with retry, DLQ, and idempotency guarantees.
    *   *Task:* Implement `EventBus` with disk-persistent event logging, exponential backoff, and dead letter routing. (Priority: High | Status: COMPLETED | Dependencies: None)

## Epic 5: Executive Business Intelligence & Analytics
*   **Feature: Executive Dashboard & Analytics Modules**
    *   *User Story:* As a hospital executive, I want interactive bar and line charts of revenue growth, bed occupancy, doctor performance, and low-stock inventory trends.
    *   *Task:* Create robust `/api/bi/` KPI endpoints, Recharts analytics tabs, and scheduled automated reporting options. (Priority: High | Status: COMPLETED | Dependencies: None)

## Epic 6: Disaster Recovery & Automated Backups
*   **Feature: Storage Provider Vaults & Snaphots**
    *   *User Story:* As an IT admin, I want to snapshot system configurations, verify backup archive integrity, and support restoring system state.
    *   *Task:* Implement `BackupService` supporting GCS/S3 variables, manual creations, and automated retention pruning. (Priority: High | Status: COMPLETED | Dependencies: None)

# Hospital ERP SaaS - Product Backlog

This is the central backlog repository for the commercial-grade, multi-tenant Hospital ERP SaaS system. It defines the product scope, execution roadmap, and backlog hierarchy across all core clinical, administrative, technical, and operational domains.

---

## 1. Epics Hierarchy

Below are the macro-level strategic goals (Epics) that drive the development of the Hospital ERP SaaS platform, sorted by implementation priority.

| Epic ID | Epic Title | Description | Target Release | Status |
|---|---|---|---|---|
| **EP-01** | Zero-Trust SaaS Core & Authentication | Secure, high-performance, and multi-tenant foundation supporting strict tenant-level data isolation, secure authentication, and global RBAC. | Phase 1 (v1.0) | **Done** |
| **EP-02** | Core Patient Clinical Journey (EMR, SOAP, & Prescriptions) | Clinical management system enabling medical personnel to handle patient intake, record structured consult histories, and order electronic scripts safely. | Phase 2 (v2.0) | **Done** |
| **EP-03** | Clinical Ancillaries & PACS Modality (Labs, Pharmacy, Radiology) | Operational execution hubs supporting laboratory sample management, pharmacy stock/expirations, and radiology PACS/DICOM imaging flows. | Phase 3 (v2.2) | **Done** |
| **EP-04** | Commercialization & Financial Subsystems (Billing, HR, Inventory) | Operational workflows focusing on tenant monetization, comprehensive medical billing, hospital staffing/HR records, and clinical product inventories. | Phase 4 (v2.3) | **In Progress** |
| **EP-05** | Decision Support, Automated Intelligence, & Integrations | Deep integration with advanced server-side LLMs for clinical guidance, alongside HL7 FHIR and CCDA healthcare interoperability. | Phase 4 (v2.4) | **In Progress** |
| **EP-06** | Real-Time Operational Infrastructure, Telemetry, & Analytics | Multi-user low-latency WebSockets, advanced business intelligence dashboards, real-time alerts, and performance metrics. | Phase 5 (v3.0) | **Todo** |

---

## 2. Features Backlog

These are the system features derived from the Epics, sorted strictly by implementation priority.

### [FEAT-101] Multi-Tenant Separation & Isolation Logic
* **Epic ID**: EP-01
* **Description**: Complete physical or logical partition of client data. All database tables and access routines must validate the active session's `clinicId` to protect patient privacy and clinic IP.
* **Business Value**: Crucial for legal, regulatory compliance (HIPAA, GDPR), and data isolation in a commercial multi-tenant SaaS environment.
* **Priority**: Critical
* **Estimated Effort**: L
* **Dependencies**: None
* **Acceptance Criteria**:
  1. No clinic is able to fetch, modify, or delete records belonging to another clinic ID.
  2. Queries for nested clinical entities (e.g., EMR, radiology, lab orders) must filter records by the matching `patient.clinicId === clinicId` or direct `clinicId` fields.
  3. Mismatched tenant access attempts must return a clean `404 Not Found` (BOLA prevention).
* **Status**: Done

### [FEAT-102] Secure Authentication & Custom RBAC Mapping
* **Epic ID**: EP-01
* **Description**: Unified identity platform using JWT authentication coupled with customizable role-based access control (RBAC) supporting clinicians, administrative staff, and patients.
* **Business Value**: Enforces standard principle of least privilege, blocking unauthorized administrative or clinical overrides.
* **Priority**: Critical
* **Estimated Effort**: M
* **Dependencies**: FEAT-101
* **Acceptance Criteria**:
  1. Login generates secure, cryptographically signed HTTP-only JWT cookies.
  2. Access is restricted according to roles (Doctor, Nurse, Receptionist, Patient, SaaS Admin).
  3. Rejects weak passwords failing standard complexity policies (length, uppercase, numbers).
* **Status**: Done

### [FEAT-201] Electronic Medical Records (EMR) Intake & SOAP Engine
* **Epic ID**: EP-02
* **Description**: Core medical record module supporting complete clinical vital signs, historical medical records, and structured SOAP (Subjective, Objective, Assessment, Plan) consultation forms.
* **Business Value**: The primary operational tool for medical practitioners to capture, review, and persist clinical encounters securely.
* **Priority**: Critical
* **Estimated Effort**: L
* **Dependencies**: FEAT-102
* **Acceptance Criteria**:
  1. Form validations enforce correct ranges for clinical vitals (blood pressure, temperature, BMI, heart rate).
  2. Doctors can save records as Drafts or finalize/sign them permanently.
  3. Once signed, an EMR record is locked against manual tampering or post-factum deletion.
* **Status**: Done

### [FEAT-301] Laboratory Order Booking & Sample Tracking
* **Epic ID**: EP-03
* **Description**: A multi-stage clinical lab processing engine supporting test orders, automated unique barcode assignment upon sample collection, analysis initiation, and validation steps.
* **Business Value**: Ensures tracking precision for clinical testing, eliminating diagnostic errors due to sample mix-ups.
* **Priority**: Critical
* **Estimated Effort**: M
* **Dependencies**: FEAT-102, FEAT-201
* **Acceptance Criteria**:
  1. Lab test booking associates a unique, queryable barcode with a patient specimen.
  2. Order states transition cleanly through: `BOOKED` -> `SAMPLE_COLLECTED` -> `IN_PROGRESS` -> `COMPLETED`.
  3. Enforces multi-tenant security blocks across all state changes.
* **Status**: Done

### [FEAT-302] Radiology PACS Modality & Imaging Pipeline
* **Epic ID**: EP-03
* **Description**: Radiology management module supporting imaging requests, automated study/series UID association from PACS simulator, draft report generation, and radiologist digital signatures.
* **Business Value**: Centralizes medical diagnostic imaging inside the primary EHR, cutting down third-party viewer licensing overhead.
* **Priority**: High
* **Estimated Effort**: L
* **Dependencies**: FEAT-102, FEAT-201
* **Acceptance Criteria**:
  1. Validates that imaging orders can only be booked for patients belonging to the clinic context.
  2. Generates randomized unique DICOM study and series IDs to simulate clinical PACS hardware.
  3. Radiologists must digitally sign/finalize reports to lock editing.
* **Status**: Done

### [FEAT-401] Comprehensive Patient Invoicing & Billing Module
* **Epic ID**: EP-04
* **Description**: End-to-end medical ledger supporting multi-item invoice generation from consultation codes, pharmaceutical sales, and laboratory testing, integrated with insurance co-pay systems.
* **Business Value**: Drives immediate clinic operational cash flow, automates financial reporting, and streamlines insurance claiming processes.
* **Priority**: High
* **Estimated Effort**: L
* **Dependencies**: FEAT-102, FEAT-201
* **Acceptance Criteria**:
  1. Generates structured, downloadable invoices listing line-items with VAT and tax details.
  2. Tracks co-pay values, outstanding debt, and logs payment methods.
  3. Integrates with regional billing/insurance lookup profiles.
* **Status**: In Progress

### [FEAT-501] Interoperable Medical Data Export (FHIR R4 & C-CDA)
* **Epic ID**: EP-05
* **Description**: Medical data transformation pipeline converting local relational patient EMR histories into standards-compliant HL7 FHIR R4 JSON bundles and XML-based Clinical Document Architecture (C-CDA) formats.
* **Business Value**: Guarantees national compliance, ensures data portability, and eases patient record transfers to outside hospital networks.
* **Priority**: High
* **Estimated Effort**: M
* **Dependencies**: FEAT-201
* **Acceptance Criteria**:
  1. Outputs valid, parsing HL7 FHIR resources representing Patient, Encounter, and Observation schemas.
  2. C-CDA exporter must correctly populate patient demographics, allergies, medications, and clinical notes.
  3. Prevents unauthorized cross-tenant data exfiltration during bulk export.
* **Status**: Done

### [FEAT-502] Gemini-Powered Clinical Decision Support (CDS)
* **Epic ID**: EP-05
* **Description**: Server-side clinical AI assistant utilizing Gemini models to analyze active symptoms, suggest differential diagnoses, and trigger warnings for allergen cross-reactions or contraindications.
* **Business Value**: Enhances diagnostic accuracy, prevents lethal prescription errors, and supports junior clinicians with validated guidance.
* **Priority**: High
* **Estimated Effort**: M
* **Dependencies**: FEAT-201
* **Acceptance Criteria**:
  1. System sends anonymized patient data to Gemini endpoints server-side.
  2. Flags drug-drug or drug-allergy interactions against patient history records.
  3. Clear warning UI informs doctors that AI output is supportive, not directive.
* **Status**: Done

### [FEAT-402] Pharmacy Inventory & Expiration Alert Engine
* **Epic ID**: EP-04
* **Description**: Drug inventory system mapping stock batches, calculating real-time consumption rates, and triggering immediate alerts for products nearing expiry or dropping below threshold levels.
* **Business Value**: Maximizes inventory cost efficiency, avoids dispensing expired products, and guarantees zero stock-outs of critical medication.
* **Priority**: Medium
* **Estimated Effort**: M
* **Dependencies**: FEAT-102
* **Acceptance Criteria**:
  1. Tracks SKU quantities dynamically as prescriptions are filled.
  2. Displays clear high-visibility visual badges for products expiring within 30 days.
  3. Sends automated email notifications to administrators for restocking.
* **Status**: Todo

### [FEAT-403] Human Resources (HR) & Clinician Scheduling
* **Epic ID**: EP-04
* **Description**: Clinician roster and scheduling engine managing shifts, active consultation hours, leave requests, and tracking basic physician payroll hours.
* **Business Value**: Prevents booking clashes, optimizes physician resource allocation, and streamlines clinic shift management.
* **Priority**: Medium
* **Estimated Effort**: M
* **Dependencies**: FEAT-102
* **Acceptance Criteria**:
  1. Clinic administrators can define shift slots per physician.
  2. Schedule booking forms block appointment selection outside defined shift intervals.
  3. Prevents overlapping shift assignments for the same clinician.
* **Status**: Todo

### [FEAT-601] Business Intelligence & Telemetry Analytics Dashboard
* **Epic ID**: EP-06
* **Description**: Executive dashboard with high-fidelity visualizations of clinic utilization rates, monthly revenue trajectories, bed occupancy levels, and general system health/API latencies.
* **Business Value**: Equips clinic leadership with actionable intelligence, promoting data-driven operational scheduling and cost-saving measures.
* **Priority**: Medium
* **Estimated Effort**: L
* **Dependencies**: FEAT-101, FEAT-401
* **Acceptance Criteria**:
  1. Features dynamic charts mapping revenue growth and appointment volumes.
  2. Renders hardware/API telemetry stats (average request durations, system status).
  3. Scopes all analytic visualizations strictly to the active clinic context.
* **Status**: Todo

### [FEAT-602] Webhook Integration Hub & Real-time Alerts
* **Epic ID**: EP-06
* **Description**: Enterprise integration service allowing clinics to configure custom HTTP webhook destinations for automatic event dispatching (e.g., patient checked-in, invoice paid).
* **Business Value**: Connects the ERP with client CRM, bookkeeping, or secondary telemetry tooling.
* **Priority**: Low
* **Estimated Effort**: L
* **Dependencies**: FEAT-101
* **Acceptance Criteria**:
  1. Clinics can register custom external URLs and select trigger events.
  2. Retries failed webhooks with exponential backoff up to 3 times.
  3. Securely signs webhook payloads with a SHA-256 HMAC header.
* **Status**: Todo

---

## 3. User Stories Backlog

Detailed agile user stories mapping real-world business expectations to clinical features.

### [US-101] Tenant Account Onboarding (Multi-tenant UI)
* **User Story**: As a Clinic Owner, I want a quick, automated onboarding flow so that I can set up my isolated medical portal and start booking patients immediately.
* **Business Value**: Increases product conversion rates by enabling self-service onboarding without manual support intervention.
* **Priority**: Critical
* **Estimated Effort**: M
* **Dependencies**: FEAT-101
* **Acceptance Criteria**:
  1. Form validates unique email, custom subdomain, and selects a subscription tier.
  2. On success, seeds default role schemas and custom parameters automatically.
  3. Generates a secure isolation schema in the database.
* **Status**: Done

### [US-102] Clinic Theme & Domain Branding
* **User Story**: As a Clinic Administrator, I want to customize our portal's primary colors, logos, and languages so that it matches our clinic's local identity and branding.
* **Business Value**: Allows premium branding upselling, increasing subscription average revenue per user (ARPU).
* **Priority**: Medium
* **Estimated Effort**: S
* **Dependencies**: FEAT-101
* **Acceptance Criteria**:
  1. Settings panel allows custom logo upload, selection of primary theme color, and language settings.
  2. Custom styles apply instantly and are stored securely under clinic configurations.
  3. Patient portal automatically inherits this branding layout on load.
* **Status**: Done

### [US-201] Quick Patient Booking & Scheduling
* **User Story**: As a Clinic Receptionist, I want to book patient appointments with a specific doctor using an interactive calendar grid to prevent scheduling conflicts.
* **Business Value**: Prevents scheduling collisions, reduces phone call delays, and speeds up daily administrative throughput.
* **Priority**: High
* **Estimated Effort**: M
* **Dependencies**: FEAT-102
* **Acceptance Criteria**:
  1. Interactive calendar displays a grid of time slots per doctor.
  2. Warns the receptionist instantly of any double-bookings for the same clinician.
  3. Sends automated notifications on successful booking or rescheduling.
* **Status**: Done

### [US-202] Clinical SOAP Notes Capture
* **User Story**: As a Doctor, I want to quickly document clinical consultations using structured SOAP note fields so that I can maintain clear records of patient clinical encounters.
* **Business Value**: Minimizes time spent on repetitive data entry, allowing doctors to focus on patient diagnosis and treatment.
* **Priority**: Critical
* **Estimated Effort**: M
* **Dependencies**: FEAT-201
* **Acceptance Criteria**:
  1. SOAP fields support formatted text input and clinical abbreviations.
  2. Dynamically links the consultation notes to the patient's EMR history log.
  3. System automatically auto-saves draft notes to prevent data loss.
* **Status**: Done

### [US-301] PACS Modality DICOM Association
* **User Story**: As an Imaging Technician, I want to associate PACS image URIs with an active radiology order so that the requesting physician can view the scan directly in the patient file.
* **Business Value**: Eliminates manual scanning and faxing of clinical reports, accelerating diagnostic turnaround.
* **Priority**: High
* **Estimated Effort**: S
* **Dependencies**: FEAT-302
* **Acceptance Criteria**:
  1. Allows entering DICOM image URL references, study UIDs, and series UIDs.
  2. Auto-updates order state to `IMAGE_ACQUIRED` on success.
  3. Restricts clinical image viewing exclusively to authorized practitioners.
* **Status**: Done

### [US-302] Laboratory Barcode Generation
* **User Story**: As a Laboratory Phlebotomist, I want to print a unique barcode label when collecting a blood specimen so that the sample is never misidentified in the lab.
* **Business Value**: Reduces diagnostic error rates to near-zero, avoiding costly clinical re-testing or malpractice risks.
* **Priority**: High
* **Estimated Effort**: S
* **Dependencies**: FEAT-301
* **Acceptance Criteria**:
  1. Clicking "Collect Sample" generates a unique random alphanumeric barcode.
  2. Renders a scannable barcode layout suitable for thermal print labeling.
  3. Tracks sample collection date, collector name, and updates status.
* **Status**: Done

### [US-401] Invoicing & Payment Collection
* **User Story**: As an Billing Officer, I want to compile a patient's consultation fees, pharmacy costs, and laboratory tests into a single invoice to streamline checkout.
* **Business Value**: Accelerates payment processing, reduces outstanding billing debt, and improves checkout efficiency.
* **Priority**: High
* **Estimated Effort**: M
* **Dependencies**: FEAT-401
* **Acceptance Criteria**:
  1. Billing screen aggregates all unbilled items associated with a patient encounter.
  2. Applies relevant tax calculations, and accepts cash, card, or insurance details.
  3. Marks the invoice as `PAID` or `PARTIALLY_PAID` in the financial ledger.
* **Status**: In Progress

### [US-501] Automated Drug Interaction Checking
* **User Story**: As a Prescribing Doctor, I want the system to alert me of any dangerous drug interactions or patient allergies when I write a prescription to ensure patient safety.
* **Business Value**: Saves lives, prevents clinical malpractice claims, and reduces medication errors.
* **Priority**: High
* **Estimated Effort**: M
* **Dependencies**: FEAT-502
* **Acceptance Criteria**:
  1. Triggers real-time evaluation of selected medications against the patient's allergen log.
  2. Displays explicit warnings if active ingredients overlap or collide.
  3. Blocks writing a contraindicated prescription unless overridden with reason logs.
* **Status**: Done

### [US-601] Real-time Inpatient Queue Board
* **User Story**: As a Nurse, I want to see a live-updating dashboard of patient statuses, bed locations, and active consultation requests to prioritize urgent care.
* **Business Value**: Coordinates ward activities, ensures timely clinician attention, and optimizes hospital bed utilization.
* **Priority**: Medium
* **Estimated Effort**: M
* **Dependencies**: FEAT-102
* **Acceptance Criteria**:
  1. Lists patients sorted by triage priority and length of wait.
  2. Updates immediately across all screens when a receptionist check-in occurs.
  3. Renders a secure dashboard suitable for ward monitors.
* **Status**: Todo

---

## 4. Technical Tasks

Under-the-hood structural tasks required to scale, secure, and maintain the system.

### [TECH-101] Express.js & Vite Dev-Server Proxy Configuration
* **Description**: Configure the main Express backend to act as a reverse proxy for Vite assets in development, serving the built production client statically on port `3000` under `NODE_ENV=production`.
* **Business Value**: Streamlines the development process, aligns development with container runtime architectures, and guarantees zero cross-origin port issues.
* **Priority**: Critical
* **Estimated Effort**: S
* **Dependencies**: None
* **Acceptance Criteria**:
  1. Dev server runs fully unified under a single entrypoint script on port `3000`.
  2. Correctly forwards front-end requests to the Vite middleware inside `server.ts`.
* **Status**: Done

### [TECH-102] ESM Bundling and Type-Stripping compilation
* **Description**: Configure build pipeline (`esbuild` and `typescript`) to strip types and bundle the backend into a cohesive CommonJS script `dist/server.cjs` to bypass Node ESM limitations.
* **Business Value**: Ensures fast container start-up times, reduces memory usage, and guarantees clean production packaging.
* **Priority**: Critical
* **Estimated Effort**: S
* **Dependencies**: None
* **Acceptance Criteria**:
  1. `npm run build` bundles the Express engine into a single file with sourcemaps.
  2. Output imports are validated and clean of TypeScript structures.
* **Status**: Done

### [TECH-201] Multi-Tenant BOLA Isolation Middleware
* **Description**: Develop an Express middleware checking patient/order contexts against active JWT session tokens, blocking unauthorized cross-clinic requests.
* **Business Value**: Provides a centralized security safeguard, reducing manual BOLA check overhead in controller layers.
* **Priority**: Critical
* **Estimated Effort**: M
* **Dependencies**: FEAT-102
* **Acceptance Criteria**:
  1. Intercepts incoming `/api/*` endpoints to extract caller information.
  2. Queries the database to verify patient or order belongs to the user's clinic ID.
  3. Returns a clean HTTP `404 Not Found` for unauthorized operations.
* **Status**: Done

### [TECH-301] Prisma Parameterized Query & Isolation Audit
* **Description**: Conduct a thorough audit of all repository classes to replace raw queries with parameterized Prisma calls, and guarantee proper clinic scoping.
* **Business Value**: Keeps database queries secure, preventing SQL injections and tenant cross-contamination.
* **Priority**: High
* **Estimated Effort**: M
* **Dependencies**: FEAT-101
* **Acceptance Criteria**:
  1. Zero instances of raw SQL string concatenations exist in repositories.
  2. Every database query includes appropriate `where` filters containing `clinicId` or patient relationship lookups.
* **Status**: Done

### [TECH-401] Structured Application Health & Latency Telemetry
* **Description**: Create automated middleware measuring request durations and logging performance metrics and system errors to a rolling memory collector.
* **Business Value**: Essential for real-time performance monitoring, diagnosing slow endpoints, and ensuring high SaaS availability.
* **Priority**: High
* **Estimated Effort**: S
* **Dependencies**: None
* **Acceptance Criteria**:
  1. Logs request metrics, response times, and HTTP status counts.
  2. Collects slow database queries (>500ms) for admin telemetry.
  3. Prevents memory leaks by maintaining a fixed rolling logs array.
* **Status**: Done

### [TECH-501] PDF Continuity Document (C-CDA) Styling engine
* **Description**: Integrate inline print stylesheets directly into patient-facing documents, ensuring clean layouts when downloading clinical continuity summaries.
* **Business Value**: Enhances document readability, providing polished clinical records for external medical practitioners.
* **Priority**: Medium
* **Estimated Effort**: S
* **Dependencies**: FEAT-501
* **Acceptance Criteria**:
  1. Media queries inside clinical reports preserve spacing and headers on export.
  2. Avoids reliance on external styling assets that may fail under offline conditions.
* **Status**: Done

---

## 5. Bugs Backlog

Identified functional errors requiring immediate remediation.

### [BUG-001] Patient Search SQL Injection Vector
* **Description**: Patient listing and global search input values are susceptible to basic SQL injection payload attempts via URL queries.
* **Business Value**: Critical to prevent database structure exposure, unauthorized data extraction, and clinical data modification.
* **Priority**: Critical
* **Estimated Effort**: S
* **Dependencies**: None
* **Acceptance Criteria**:
  1. Filters and rejects search strings containing dynamic SQL keywords (e.g., `OR 1=1`, `UNION ALL`).
  2. Sanitizer middleware blocks matching payloads with a clear `403 Forbidden` error.
* **Status**: Done

### [BUG-002] File Upload High-Risk Extensions Bypass
* **Description**: File upload endpoint allows saving executable extensions (e.g., `.sh`, `.php`), presenting high remote code execution (RCE) risks to backend servers.
* **Business Value**: Secures clinical storage, avoiding severe server intrusions or data compromises.
* **Priority**: Critical
* **Estimated Effort**: S
* **Dependencies**: None
* **Acceptance Criteria**:
  1. File upload parser rejects any uploads with dangerous extensions or mime-types.
  2. Enforces a strict 10MB maximum payload threshold per upload.
* **Status**: Done

### [BUG-003] Cross-Site Scripting (XSS) in Doctor Notes
* **Description**: Input fields on clinical SOAP note and diagnosis modules do not sanitize HTML strings, allowing persistence of harmful inline scripts.
* **Business Value**: Prevents session hijacking, credential theft, and unauthorized patient data access via active administrative panels.
* **Priority**: Critical
* **Estimated Effort**: S
* **Dependencies**: None
* **Acceptance Criteria**:
  1. Recursively scrubs request parameters, bodies, and headers of dangerous tags (e.g. `<script>`, `onload`).
  2. Converts raw angle brackets to safe HTML entities before saving.
* **Status**: Done

### [BUG-004] CSRF Attack Vector on State-Changing API Verbs
* **Description**: API routes do not validate request origin boundaries, leaving clinics vulnerable to cross-site request forgery attacks.
* **Business Value**: Prevents unauthorized modifications (e.g., changing password or deleting EMRs) initiated by external websites.
* **Priority**: High
* **Estimated Effort**: S
* **Dependencies**: None
* **Acceptance Criteria**:
  1. Middleware checks incoming `Origin` and `Referer` headers against verified hosts on state-changing requests.
  2. Blocks requests with mismatching, untrusted domain headers.
* **Status**: Done

### [BUG-005] Calendar Scheduling Race Condition Double-Booking
* **Description**: Simultaneous appointment bookings for the same doctor at the same time succeed on slow networks, creating operational conflicts.
* **Business Value**: Avoids clinical schedule clashing, clinician burnout, and poor patient checkout experiences.
* **Priority**: High
* **Estimated Effort**: M
* **Dependencies**: FEAT-102
* **Acceptance Criteria**:
  1. Wraps schedule operations in strict database transaction locks.
  2. Aborts transaction and informs the user if a slot is booked concurrently by another receptionist.
* **Status**: Todo

---

## 6. Technical Debt Backlog

Non-urgent structural code quality refinements.

### [TD-101] Prisma Schema Model Refactoring
* **Description**: Consolidate redundant fields across Patient, Tenant, and User entities in `schema.prisma` to simplify relationships and optimize database queries.
* **Business Value**: Simplifies entity mapping, speeds up ORM operations, and improves database maintainability.
* **Priority**: Medium
* **Estimated Effort**: M
* **Dependencies**: None
* **Acceptance Criteria**:
  1. Merges overlapping fields into unified, clean model definitions.
  2. All test suites pass successfully under the updated schema structure.
* **Status**: Todo

### [TD-102] React Component Separation (Modularity Cleanup)
* **Description**: Extract large, monolithic JSX components (such as `Laboratory.tsx` and `Radiology.tsx`) into separate, modular components to avoid file generation limits.
* **Business Value**: Improves visual responsiveness, simplifies front-end debugging, and speeds up feature updates.
* **Priority**: Medium
* **Estimated Effort**: M
* **Dependencies**: None
* **Acceptance Criteria**:
  1. Extracts dialogs, custom charts, and filters into dedicated sub-directories.
  2. App builds cleanly without bundle size warnings or circular import problems.
* **Status**: Todo

### [TD-103] Unified Tailwind CSS Configuration Upgrade
* **Description**: Move custom styles and color presets into Vite's Tailwind configuration to reduce inline style duplication in components.
* **Business Value**: Standardizes visual style consistency across all developer branches.
* **Priority**: Low
* **Estimated Effort**: S
* **Dependencies**: None
* **Acceptance Criteria**:
  1. Custom theme parameters compile successfully under standard Vite plugins.
  2. No duplicate style configurations exist in CSS source files.
* **Status**: Done

### [TD-104] Frontend Inactive State Management Cleanups (Race Conditions)
* **Description**: Resolve asynchronous state race conditions inside patient view controllers where records may be requested on undefined/changing states.
* **Business Value**: Ensures continuous, stable client-side app experiences during quick user interactions.
* **Priority**: Medium
* **Estimated Effort**: S
* **Dependencies**: None
* **Acceptance Criteria**:
  1. Implements cleanup functions on React state triggers.
  2. Gracefully handles undefined states without crashing the viewport.
* **Status**: Done

---

## 7. Backlog Prioritization Matrix

The backlog sorted by implementation order to guide developers during active sprints.

```
   CRITICAL PRIORITY (Must Have)
   ┌─────────────────────────────────────────────────────────┐
   │ [BUG-001] Patient Search SQL Injection Vector           │ (Done)
   │ [BUG-002] File Upload High-Risk Extensions Bypass       │ (Done)
   │ [BUG-003] Cross-Site Scripting (XSS) in Doctor Notes    │ (Done)
   │ [FEAT-101] Multi-Tenant Separation & Isolation Logic    │ (Done)
   │ [FEAT-102] Secure Authentication & Custom RBAC Mapping  │ (Done)
   │ [TECH-101] Express.js & Vite Dev-Server Proxy Config    │ (Done)
   │ [TECH-102] ESM Bundling & Type-Stripping Compilation    │ (Done)
   │ [TECH-201] Multi-Tenant BOLA Isolation Middleware       │ (Done)
   │ [US-101] Tenant Account Onboarding Flow                 │ (Done)
   │ [FEAT-201] Electronic Medical Records SOAP Engine       │ (Done)
   │ [US-202] Clinical SOAP Notes Capture                    │ (Done)
   │ [FEAT-301] Lab Order Booking & Sample Tracking          │ (Done)
   └───────────────────────────┬─────────────────────────────┘
                               │
                               ▼
   HIGH PRIORITY (Should Have)
   ┌─────────────────────────────────────────────────────────┐
   │ [BUG-004] CSRF Attack Vector on State-Changing APIs     │ (Done)
   │ [TECH-301] Prisma Parameterized Query & Isolation Audit │ (Done)
   │ [TECH-401] Structured Health & Latency Telemetry        │ (Done)
   │ [FEAT-302] Radiology PACS Modality & Imaging Pipeline   │ (Done)
   │ [US-301] PACS Modality DICOM Association                 │ (Done)
   │ [US-302] Laboratory Barcode Generation                  │ (Done)
   │ [FEAT-501] Interoperable Data Export (FHIR/CCDA)        │ (Done)
   │ [FEAT-502] Gemini-Powered Decision Support (CDS)        │ (Done)
   │ [US-501] Automated Drug Interaction Checking            │ (Done)
   │ [US-201] Quick Patient Booking & Scheduling             │ (Done)
   │ [FEAT-401] Patient Invoicing & Billing Module           │ (In Progress)
   │ [US-401] Invoicing & Payment Collection                 │ (In Progress)
   │ [BUG-005] Calendar Double-Booking Race Condition        │ (Todo)
   └───────────────────────────┬─────────────────────────────┘
                               │
                               ▼
   MEDIUM PRIORITY (Could Have)
   ┌─────────────────────────────────────────────────────────┐
   │ [US-102] Clinic Theme & Domain Branding                  │ (Done)
   │ [TECH-501] PDF Continuity Document (C-CDA) Styling Engine│ (Done)
   │ [TD-104] Frontend Inactive State Management Race Clean  │ (Done)
   │ [FEAT-402] Pharmacy Inventory & Expiry alerts            │ (Todo)
   │ [FEAT-403] HR Shift & Physician Scheduling               │ (Todo)
   │ [FEAT-601] BI & Telemetry Analytics Dashboard           │ (Todo)
   │ [TD-101] Prisma Schema Model Refactoring                │ (Todo)
   │ [TD-102] React Component Separation Modularity Cleanup  │ (Todo)
   └───────────────────────────┬─────────────────────────────┘
                               │
                               ▼
   LOW PRIORITY (Nice to Have)
   ┌─────────────────────────────────────────────────────────┐
   │ [US-601] Real-time Inpatient Queue Board                │ (Todo)
   │ [FEAT-602] Webhook Integration Hub & Real-time Alerts   │ (Todo)
   │ [TD-103] Unified Tailwind CSS Configuration Upgrade     │ (Done)
   └─────────────────────────────────────────────────────────┘
```

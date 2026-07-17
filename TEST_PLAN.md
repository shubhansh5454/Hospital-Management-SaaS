# Hospital ERP SaaS Test Plan

This document outlines the testing strategy, frameworks, and detailed test coverage plans to ensure a secure, HIPAA-compliant, and robust multi-tenant Electronic Health Record (EHR) & Hospital ERP SaaS platform.

---

## 1. Testing Philosophy & Standards

The application handles highly sensitive **Protected Health Information (PHI)** and operational assets. Therefore, testing must adhere to:
- **Zero Trust Security:** Explicitly verifying multi-tenant clinic boundary isolation (BOLA/IDOR protection) on all operations.
- **High Automation:** Complete regression verification on every pull request/build via automated test suites.
- **HL7/FHIR Compliance Validation:** Certifying data structure schemas match official R4 JSON specifications.
- **Data Protection Controls:** Verifying sanitization against XSS, input filtration, and strict security headers.

---

## 2. Test Execution Engine

The automated test runner executes on a custom, high-speed unit and integration runner situated in `/tests/runner.ts` using `tsx`.

### Execution Command:
```bash
npm test
```

---

## 3. Automated Test Suites Structure

The automated test suite in `/tests/runner.ts` is divided into 8 core pillars:

### Suite 1: Security Sanitization Unit Tests
- **XSS Stripping:** Validates that dangerous scripts (e.g., `<script>`, inline event handlers) are scrubbed or escaped in patient data.
- **Protocol Blocking:** Restricts dangerous URL protocols like `javascript:` inside fields and query parameters.
- **Telemetry Counters:** Assures rolling latency counters and slow request metrics work perfectly.

### Suite 2: Pipeline Telemetry & Security Integration
- **Token Rate Limiting:** Verifies request limits block malicious burst/brute force queries and output precise headers.
- **Metric Event Triggers:** Inspects if triggering limits registers automatic error alerts within system telemetry.

### Suite 3: Middleware API Defense
- **CSP & Strict Headers:** Ensures strict frame ancestors, Content Security Policy, and sniffer protections are attached.
- **CSRF Defense:** Checks state-changing HTTP methods from untrusted domains are blocked.
- **SQL Injection Defense:** Evaluates and intercepts attack pattern strings (e.g. `' OR 1=1 --`, `UNION SELECT`) inside searches.

### Suite 4: Authentication & Password Policy
- **Strength Validation:** Checks requirement policies for password lengths, casing, and symbol inclusions.

### Suite 5: Database Schema & Storage Controls
- **Upload Validation:** Enforces file size limitations (e.g., 10MB maximums) and rejects malicious shell files (`.sh`) while welcoming safe media types (`.png`).
- **Database Latency Probes:** Validates connection stability check services.

### Suite 6: Frontend UI Components Check
- **Sub-Tab Router Mapping:** Ensures UI tab changes trigger appropriate view components.
- **System Telemetry Badges:** Confirms diagnostic system state and status badges render real values from the backend.

### Suite 7: Clinical Data Interoperability & Multi-Tenancy (Epic 2 Interoperability)
- **FHIR Schema Integration:** Asserts the backend compiled resource is a compliant `Bundle` featuring aligned patient and encounter resources.
- **C-CDA Generation:** Inspects generated clinical Continuity of Care Documents for matching histories, allergies, and diagnoses.
- **Clinic Multi-Tenant Isolation:** Verifies BOLA protection where a user bound to one clinic context is blocked from fetching or exporting records belonging to another clinic ID.

### Suite 8: Radiology Multi-Tenant Isolation Security Tests
- **Secure Ordering Boundary**: Assures that imaging orders can only be created for patients residing in the clinician's matching clinic domain.
- **Order Retrieval Isolation**: Checks that retrieval requests for imaging orders fail with a 404 whenever the request origin clinic ID mismatches.

---

## 4. Manual Verification & User Acceptance Testing (UAT)

To complement the automated suite, manual QA engineers execute standard UAT test scripts for clinical workflows:

| Use Case | Actions | Expected Output | Status |
| :--- | :--- | :--- | :--- |
| **Print C-CDA Summary** | Click *Export (FHIR/CCDA)* button, switch to *C-CDA* tab, select *Print Summary*. | Launches system print screen using a sandboxed iframe without being blocked by popup settings. | Passed |
| **Download Patient History** | Click *Download FHIR Bundle* or *Download CCDA*. | Generates a valid file download stream with appropriate JSON or HTML mime-types. | Passed |
| **Defensive State Verification** | Trigger export while patient context changes or is unloaded. | Prevents javascript errors gracefully using optional chaining on export triggers. | Passed |
| **Tenant Switching** | Standard Doctor from Clinic A requests `/api/patients/{id}/export` of Clinic B's patient. | Denied with a clear `404 Patient not found` error, preserving maximum security and tenant privacy. | Passed |
| **Radiology Order Tenant Cross-Access** | Clinician from Clinic A attempts to retrieve or edit a radiology imaging order of a patient from Clinic B. | Blocked instantly with a clear `404 Radiology order not found` response, preventing cross-tenant access. | Passed |

# Architecture Decision Records (ADRs)

## ADR 1: Unified CommonJS Server Bundling via esbuild
*   **Context:** Node.js enforces strict ES Module relative path resolution (e.g., demanding explicit `.js` or `.ts` extensions in imports), leading to runtime path-resolution bugs when deploying TypeScript containers.
*   **Decision:** Bundle `server.ts` into a single, optimized CJS file (`dist/server.cjs`) via `esbuild --bundle --platform=node --format=cjs`.
*   **Consequences:** Complete bypass of Node's strict ESM import checks, faster server cold starts, and zero dependency path resolution issues at runtime.

## ADR 2: In-Memory Event Bus with Disk-Persistent Logging
*   **Context:** High transactional volume of appointments and clinical entries needs reliable event dispatching without introducing heavy external message queues (like RabbitMQ) in the base stack.
*   **Decision:** Build a custom, robust, memory-backed `EventBus` paired with asynchronous fs-based transactional logging (`event_logs.json`) and a dedicated Dead Letter Queue (`event_dlq.json`).
*   **Consequences:** Built-in message durability, exponential backoff retries, explicit idempotency checks via event IDs, and automated DLQ routing.

## ADR 3: HL7 FHIR R4 JSON & CCDA Interoperability Standard
*   **Context:** Hospital systems require standards-based data portability. Exposing proprietary database JSON structures to third-party providers blocks clinical transfers and breaches HIPAA portability mandates.
*   **Decision:** Implement standard HL7 FHIR (Fast Healthcare Interoperability Resources) R4 Patient Resource Bundle and CCDA (Continuity of Care Document Architecture) HTML structures as the native clinical export format.
*   **Consequences:** Absolute compliance with standard healthcare data formats, easy printing/sharing of patient records, and native interoperability with third-party hospital software.

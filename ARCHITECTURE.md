# Hospital ERP SaaS - Architecture Documentation

## 1. High-Level System Architecture
The platform is designed as a modular, full-stack enterprise monolith with a high-performance Express.js backend and an optimized React + Vite single-page application (SPA) frontend.

```
       [ Client-Side Web Browsers ]
                    │
         HTTP / WebSockets (Port 3000)
                    ▼
          [ Express.js Server ]
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
[Middleware]   [API Routes]   [Vite Engine]
     │              │              │
     ▼              ▼              ▼
 [Security]    [Controllers]  [SPA Assets]
                    │
                    ▼
               [Services]
                    │
                    ▼
             [Repositories]
                    │
                    ▼
               [Prisma Client]
                    │
                    ▼
            [ PostgreSQL DB ]
```

## 2. Directory Layout & Modular Structure
- `/src/components`: Front-end components, layouts, and page controllers.
- `/src/server/routes`: API routers organized by clinical module (EMR, billing, radiology, lab, inventory).
- `/src/server/controllers`: Request parsers, validation triggers, and auditor integrations.
- `/src/server/services`: High-fidelity business logic executors, CDS AI rule processors, and clinical compliance builders.
- `/src/server/repositories`: Direct data persistence clients encapsulating PostgreSQL/Prisma operations.
- `/tests`: Custom test engine and automated quality suite.

## 3. Multi-Tenancy Design
The platform uses logical tenant isolation at the database layer. All data queries check clinic relationships:
- Direct: Models storing `clinicId` are queried with strict clauses (`where: { clinicId }`).
- Indirect (Radiology, EMR): Models associated with a Patient are verified by filtering on `patient.clinicId === clinicId`, preventing BOLA vulnerabilities across the platform.

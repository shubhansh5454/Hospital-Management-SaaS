# Hospital ERP SaaS - Database Schema & Isolation Patterns

## 1. Relational Database Design
The application utilizes a PostgreSQL schema managed with Prisma. Below are the key tables and relationships:

### Core SaaS Entities
- `Tenant`: Top-level customer subscription node.
- `Clinic`: Operational clinic entities grouped under a Tenant, with settings, working hours, and custom domains.
- `User`: Accounts containing clinicians, administrative staff, and patients. Grouped under a Clinic.
- `CustomRole`: Clinic-level role profiles mapped to specific functional permissions.

### Clinical Entities
- `Patient`: Patient demography and contact records. Contains a `clinicId` field.
- `EmrRecord`: Structured clinical consult records (vitals, SOAP notes, prescriptions) referencing a doctor and patient.
- `ImagingOrder`: Radiology exam requests containing modality (X-RAY, CT, etc.), body part, and status. Linked to a Patient.
- `RadiologyReport`: Structured findings, impressions, and signature status for an ImagingOrder. Linked to a Patient.
- `LabOrder`: Lab test bookings with collection dates, barcodes, and values.

## 2. Multi-Tenant Data Isolation Strategy
Rather than maintaining separate database instances (which increases operational and cold-start costs), the ERP employs **logical schema-level isolation** (Shared Database, Shared Schema):

```
                       ┌──────────────┐
                       │    Clinic    │
                       └──────┬───────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
     ┌──────────────┐                    ┌──────────────┐
     │    Patient   │                    │     User     │
     └──────┬───────┘                    └──────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
┌──────────────┐┌──────────────┐
│ ImagingOrder ││  EmrRecord   │
└──────────────┘└──────────────┘
```

By enforcing `where: { clinicId }` on all root queries and validating `patient.clinicId` on nested clinical elements, the system achieves commercial-grade SaaS security and prevents cross-tenant data leaks.

# Hospital ERP SaaS - Sprint Backlog

## Sprint Goal
Harden tenant isolation boundaries in the Radiology and PACS integration modules, eliminating any cross-clinic Broken Object Level Authorization (BOLA) risks, while maintaining full automated test coverage.

## Backlog Items

### 1. Radiology Module Multi-Tenant Refactoring
- [x] **Secure RadiologyService**: Add `clinicId` parameters to all service methods (`createOrder`, `getAllOrders`, `getOrderById`, `updateOrderStatus`, `acquireImage`, `saveReport`, `approveReport`, `getReportByOrderId`, `getPatientHistory`). Verify mismatch before any write or read operation.
- [x] **Secure RadiologyController**: Extract `req.user.clinicId` in all Express controllers and supply it to the respective service methods.
- [x] **Secure Database Queries**: Update `findAllOrders` in `RadiologyRepository` to filter records by `patient.clinicId === clinicId` to prevent data exposure on listing views.

### 2. Multi-Tenant Test Coverage
- [x] **Suite 8 Implementation**: Write automated async integration tests in `tests/runner.ts` mocking mismatched clinics and verifying that:
  - Valid clinic context queries succeed.
  - Cross-clinic access requests fail with appropriate HTTP 404 (Patient/Order not found) errors.

### 3. Documentation Alignment
- [x] **Artifact Updates**: Update Vision, Requirements, Backlogs, Architecture, Security, and Change logs to reflect PACS/Radiology BOLA hardening.

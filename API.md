# Hospital ERP SaaS - API Specifications

## 1. Authentication & Security
- All requests to clinical endpoints (`/api/v1/*`) require a valid JWT token passed in the `Authorization` header:
  `Authorization: Bearer <TOKEN>`
- CSRF, HSTS, Rate limiting, and BOLA checks are applied by default.

## 2. Radiology & PACS API Endpoints

### 2.1 Create Imaging Order
- **Endpoint**: `POST /api/v1/radiology/orders`
- **Access**: Doctor, Admin
- **Payload**:
  ```json
  {
    "patientId": 505,
    "modality": "CT",
    "bodyPart": "Abdomen",
    "reason": "Abdominal pain",
    "priority": "URGENT",
    "orderDate": "2026-07-17",
    "notes": "Suspected appendicitis"
  }
  ```
- **Response**: `201 Created` with the order schema.

### 2.2 List Orders
- **Endpoint**: `GET /api/v1/radiology/orders`
- **Access**: Doctor, Admin, Receptionist, Patient (Patient receives only their own orders)
- **Parameters**: `patientId` (optional), `status` (optional), `search` (optional)
- **Behavior**: Returns only orders belonging to the authenticated user's clinic.

### 2.3 Get Specific Order
- **Endpoint**: `GET /api/v1/radiology/orders/:id`
- **Access**: Doctor, Admin, Receptionist, Patient
- **Behavior**: Returns the order and its reports if they belong to the user's clinic, otherwise returns `404 Not Found`.

### 2.4 PACS Image Acquisition
- **Endpoint**: `POST /api/v1/radiology/orders/:id/acquire`
- **Access**: Doctor, Admin
- **Payload**:
  ```json
  {
    "imageUrl": "https://pacs.clinic.org/dicom/series/img_192.png",
    "seriesUid": "1.2.840.113619.2.12345",
    "studyUid": "1.2.840.113619.6.12345"
  }
  ```
- **Behavior**: Associates DICOM references with the order. Returns the drafted report.

### 2.5 Save Report Draft
- **Endpoint**: `POST /api/v1/radiology/orders/:id/report`
- **Access**: Doctor, Admin
- **Payload**:
  ```json
  {
    "findings": "Normal appendix. High density fecalith noted.",
    "impression": "No appendicitis. Resolving mild colitis.",
    "recommendations": "Clinical correlation",
    "status": "DRAFT"
  }
  ```
- **Response**: `200 OK` with saved report.

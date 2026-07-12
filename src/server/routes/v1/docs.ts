import { Router, Response } from 'express';

const router = Router();

// OpenAPI 3.0 Specification
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Sanctuary Hospital Versioned Mobile APIs',
    description: 'Highly optimized, rate-limited, paginated RESTful APIs designed for Android & iOS client integration.',
    version: '1.0.0',
    contact: {
      name: 'Sanctuary Clinical Development Team',
      email: 'clinical-dev@sanctuaryhospital.com'
    }
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current Environment'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your access token to perform operations.'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Something went wrong.' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 12 },
          email: { type: 'string', example: 'doctor.john@hospital.com' },
          name: { type: 'string', example: 'Dr. John Doe' },
          role: { type: 'string', example: 'doctor' },
          clinicId: { type: 'integer', nullable: true, example: 1 },
          createdAt: { type: 'string', format: 'date-time', example: '2026-07-12T05:00:00.000Z' }
        }
      },
      Patient: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 5 },
          name: { type: 'string', example: 'Alice Johnson' },
          email: { type: 'string', example: 'alice@gmail.com' },
          phone: { type: 'string', example: '+1555123456' },
          dob: { type: 'string', format: 'date', example: '1992-05-18' },
          gender: { type: 'string', example: 'Female' },
          bloodGroup: { type: 'string', nullable: true, example: 'O+' },
          address: { type: 'string', nullable: true, example: '456 Elm St, New York' },
          medicalHistory: { type: 'string', nullable: true, example: 'Chronic asthma' },
          allergies: { type: 'string', nullable: true, example: 'Penicillin' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-07-12T05:00:00.000Z' },
          clinicId: { type: 'integer', nullable: true, example: 1 }
        }
      },
      Appointment: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 25 },
          patientId: { type: 'integer', example: 5 },
          doctorId: { type: 'integer', example: 12 },
          date: { type: 'string', format: 'date', example: '2026-07-20' },
          time: { type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '14:30' },
          status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'], example: 'scheduled' },
          reason: { type: 'string', example: 'General checkup' },
          notes: { type: 'string', nullable: true, example: 'Fasting 12 hours required' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-07-12T05:00:00.000Z' },
          clinicId: { type: 'integer', nullable: true, example: 1 }
        }
      },
      PaginationMetadata: {
        type: 'object',
        properties: {
          totalCount: { type: 'integer', example: 45 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          totalPages: { type: 'integer', example: 5 },
          hasNextPage: { type: 'boolean', example: true },
          hasPrevPage: { type: 'boolean', example: false }
        }
      }
    }
  },
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'new-user@hospital.com' },
                  password: { type: 'string', minLength: 6, example: 'S3curePass!' },
                  name: { type: 'string', example: 'John Carter' },
                  role: { type: 'string', enum: ['admin', 'doctor', 'receptionist', 'patient'], default: 'patient', example: 'patient' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        accessToken: { type: 'string', example: 'eyJhbGci...' },
                        refreshToken: { type: 'string', example: 'eyJhbGci...' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Validation failed or User already exists',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Log in and receive JWT tokens',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'doctor.john@hospital.com' },
                  password: { type: 'string', example: 'DoctorPass123!' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Authenticated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/User' },
                        accessToken: { type: 'string', example: 'eyJhbGci...' },
                        refreshToken: { type: 'string', example: 'eyJhbGci...' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh access tokens using valid Refresh Token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string', example: 'eyJhbGci...' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Tokens refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string', example: 'eyJhbGci...' },
                        refreshToken: { type: 'string', example: 'eyJhbGci...' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid or expired refresh token',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },
    '/auth/me': {
      get: {
        summary: 'Retrieve current authenticated user profile',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Profile loaded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/User' }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized access',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
          }
        }
      }
    },
    '/patients': {
      get: {
        summary: 'List clinical patients with filters and search',
        tags: ['Patients'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', required: false, schema: { type: 'string' }, description: 'Search term for name, email, phone' },
          { name: 'gender', in: 'query', required: false, schema: { type: 'string' }, description: 'Filter by exact gender' },
          { name: 'bloodGroup', in: 'query', required: false, schema: { type: 'string' }, description: 'Filter by blood group' },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10 }, description: 'Page record size limit' }
        ],
        responses: {
          '200': {
            description: 'List retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Patient' } },
                    pagination: { $ref: '#/components/schemas/PaginationMetadata' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Create a new patient record',
        tags: ['Patients'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'phone', 'dob', 'gender'],
                properties: {
                  name: { type: 'string', example: 'Robert Lang' },
                  email: { type: 'string', format: 'email', example: 'robert.lang@example.com' },
                  phone: { type: 'string', example: '+1888234567' },
                  dob: { type: 'string', format: 'date', example: '1987-11-23' },
                  gender: { type: 'string', example: 'Male' },
                  bloodGroup: { type: 'string', example: 'A-' },
                  address: { type: 'string', example: '99 Wall St, NY' },
                  medicalHistory: { type: 'string', example: 'No history of chronic issues' },
                  allergies: { type: 'string', example: 'Pollen' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Patient created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/Patient' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/appointments': {
      get: {
        summary: 'List clinic appointments with filters',
        tags: ['Appointments'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'doctorId', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'patientId', in: 'query', required: false, schema: { type: 'integer' } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['scheduled', 'completed', 'cancelled'] } },
          { name: 'date', in: 'query', required: false, schema: { type: 'string', format: 'date' } },
          { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          '200': {
            description: 'List retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Appointment' } },
                    pagination: { $ref: '#/components/schemas/PaginationMetadata' }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: 'Schedule a new clinical appointment',
        tags: ['Appointments'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['patientId', 'doctorId', 'date', 'time', 'reason'],
                properties: {
                  patientId: { type: 'integer', example: 5 },
                  doctorId: { type: 'integer', example: 12 },
                  date: { type: 'string', format: 'date', example: '2026-07-20' },
                  time: { type: 'string', example: '10:30' },
                  reason: { type: 'string', example: 'Follow up ultrasound' },
                  notes: { type: 'string', example: 'Patient requested Dr. Doe' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Appointment scheduled successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/Appointment' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/doctors': {
      get: {
        summary: 'List available doctors with availability schedule',
        tags: ['Doctors'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'specialization', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          '200': {
            description: 'Doctors list retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          name: { type: 'string' },
                          email: { type: 'string' },
                          role: { type: 'string' },
                          doctorProfile: {
                            type: 'object',
                            properties: {
                              specialization: { type: 'string' },
                              biography: { type: 'string' },
                              experienceYrs: { type: 'integer' },
                              schedules: { type: 'array', items: { type: 'object' } }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/upload': {
      post: {
        summary: 'Upload profile pictures or EMR files (Base64-encoded)',
        tags: ['Files & Storage'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'mimeType', 'content'],
                properties: {
                  name: { type: 'string', example: 'avatar_patient_5.png' },
                  fileType: { type: 'string', enum: ['image', 'pdf', 'lab_report', 'prescription', 'patient_doc'], default: 'image' },
                  mimeType: { type: 'string', example: 'image/png' },
                  content: { type: 'string', example: 'iVBORw0KGgoAAAANSUhEUgAAAAUA...' },
                  patientId: { type: 'integer', example: 5 }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'File uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        name: { type: 'string' },
                        mimeType: { type: 'string' },
                        size: { type: 'integer' },
                        downloadUrl: { type: 'string', example: '/api/v1/files/42/content' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

// Return OpenAPI specification JSON
router.get('/openapi.json', (req, res) => {
  res.status(200).json(openApiSpec);
});

// Render interactive Swagger UI playground
router.get('/', (req, res) => {
  res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sanctuary Mobile REST API Playground</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #f8fafc;
      padding: 24px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .header p {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: #94a3b8;
    }
    .doc-badge {
      background-color: #10b981;
      color: white;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
    }
    #swagger-ui {
      max-width: 1200px;
      margin: 20px auto;
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🏥 Sanctuary REST API Documentation</h1>
      <p>Versioned Sandbox Portal for Android & iOS App Integrations</p>
    </div>
    <span class="doc-badge">v1.0.0 Stable</span>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        deepLinking: true,
        docExpansion: "list"
      });
    };
  </script>
</body>
</html>
  `);
});

export const v1DocsRouter = router;

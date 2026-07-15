import { Router } from 'express';

const router = Router();

// OpenAPI 3.0.3 Specification for Version 2 APIs
const openApiSpecV2 = {
  openapi: '3.0.3',
  info: {
    title: 'CareSync SaaS Enterprise Version 2 APIs',
    description: 'Modernized, paginated RESTful API layer with expanded telemetry, database aggregation, and telehealth features.',
    version: '2.0.0',
    contact: {
      name: 'CareSync Enterprise Development Team',
      email: 'enterprise-support@caresync-saas.com'
    }
  },
  servers: [
    {
      url: '/api/v2',
      description: 'Production V2 Active Gateway'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT access token to authenticate.'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Validation failed' }
        }
      },
      V2User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 12 },
          email: { type: 'string', example: 'dr.alex@caresync.com' },
          name: { type: 'string', example: 'Dr. Alex Mercer' },
          role: { type: 'string', example: 'doctor' },
          createdAt: { type: 'string', format: 'date-time', example: '2026-07-12T05:00:00.000Z' }
        }
      },
      V2Clinic: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'CareSync General Practice' },
          slug: { type: 'string', example: 'caresync-general-practice' }
        }
      },
      V2Patient: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 5 },
          name: { type: 'string', example: 'Alice Johnson' },
          email: { type: 'string', example: 'alice@gmail.com' },
          phone: { type: 'string', example: '+1555123456' },
          dob: { type: 'string', format: 'date', example: '1992-05-18' },
          gender: { type: 'string', example: 'Female' },
          bloodGroup: { type: 'string', nullable: true, example: 'O+' },
          statistics: {
            type: 'object',
            properties: {
              appointmentsCount: { type: 'integer', example: 12 },
              emrRecordsCount: { type: 'integer', example: 8 },
              invoicesCount: { type: 'integer', example: 3 },
              isCritical: { type: 'boolean', example: false }
            }
          }
        }
      },
      V2Appointment: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 42 },
          patientId: { type: 'integer', example: 5 },
          doctorId: { type: 'integer', example: 12 },
          date: { type: 'string', format: 'date', example: '2026-07-20' },
          time: { type: 'string', pattern: '^\\d{2}:\\d{2}$', example: '14:30' },
          status: { type: 'string', example: 'scheduled' },
          reason: { type: 'string', example: 'Standard follow-up' },
          delivery: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['TELEHEALTH', 'IN_PERSON'], example: 'TELEHEALTH' },
              virtualRoomUrl: { type: 'string', nullable: true, example: 'https://meet.jit.si/caresync-42-5' }
            }
          },
          priority: { type: 'string', enum: ['NORMAL', 'HIGH'], example: 'NORMAL' }
        }
      }
    }
  },
  paths: {
    '/auth/login': {
      post: {
        summary: 'Log in with V2 specs (including Clinic branding properties)',
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
            description: 'Authentication success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    apiVersion: { type: 'string', example: '2.0.0' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/V2User' },
                        tokens: {
                          type: 'object',
                          properties: {
                            accessToken: { type: 'string' },
                            refreshToken: { type: 'string' }
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
    '/auth/me': {
      get: {
        summary: 'Fetch self profile with full permission policies',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    apiVersion: { type: 'string', example: '2.0.0' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/V2User' },
                        permissions: { type: 'array', items: { type: 'string' } },
                        clinic: { $ref: '#/components/schemas/V2Clinic' }
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
    '/patients': {
      get: {
        summary: 'Get patients list with DB statistics indicators',
        tags: ['Patients'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }
        ],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    apiVersion: { type: 'string', example: '2.0.0' },
                    data: {
                      type: 'object',
                      properties: {
                        patients: { type: 'array', items: { $ref: '#/components/schemas/V2Patient' } }
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
    '/appointments': {
      get: {
        summary: 'Retrieve clinic appointments with Priority metrics',
        tags: ['Appointments'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    apiVersion: { type: 'string', example: '2.0.0' },
                    data: {
                      type: 'object',
                      properties: {
                        appointments: { type: 'array', items: { $ref: '#/components/schemas/V2Appointment' } }
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
  res.status(200).json(openApiSpecV2);
});

// Render interactive Swagger UI playground for V2
router.get('/', (req, res) => {
  res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CareSync SaaS - Developer V2 REST API Suite</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .header {
      background: linear-gradient(135deg, #0d9488 0%, #115e59 100%);
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
      color: #ccfbf1;
    }
    .doc-badge {
      background-color: #f59e0b;
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
      <h1>🏥 CareSync SaaS Version 2.0 API Sandbox</h1>
      <p>Modern Telemetry, Aggregated Patient Insights, and Telehealth Integrations</p>
    </div>
    <span class="doc-badge">v2.0.0 Stable</span>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v2/docs/openapi.json',
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

export const v2DocsRouter = router;
export default v2DocsRouter;

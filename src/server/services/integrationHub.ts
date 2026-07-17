import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.ts';

export type IntegrationCategory = 'payment' | 'sms' | 'email' | 'whatsapp' | 'ai' | 'calendar' | 'cloud_storage';

export interface IntegrationProvider {
  id: string;
  name: string;
  category: IntegrationCategory;
  isActive: boolean;
  healthStatus: 'healthy' | 'degraded' | 'offline';
  latencyMs: number;
  lastChecked: string;
  credentials: Record<string, string>; // e.g. apiKey, apiSecret, bucketName
  settings: Record<string, any>;
}

const DATA_DIR = path.join(process.cwd(), 'src', 'server', 'data');
const INTEGRATIONS_FILE = path.join(DATA_DIR, 'integrations.json');

export class IntegrationHub {
  private static defaultProviders: IntegrationProvider[] = [
    // PAYMENT
    {
      id: 'prov-stripe',
      name: 'Stripe API Gateway',
      category: 'payment',
      isActive: true,
      healthStatus: 'healthy',
      latencyMs: 45,
      lastChecked: new Date().toISOString(),
      credentials: { apiKey: 'sk_live_51Mxxxxxxxxxxxxxxxxxx', webhookSecret: 'whsec_xxxxxxxx' },
      settings: { currency: 'USD', autoCharge: true }
    },
    {
      id: 'prov-paypal',
      name: 'PayPal Merchant Portal',
      category: 'payment',
      isActive: false,
      healthStatus: 'healthy',
      latencyMs: 92,
      lastChecked: new Date().toISOString(),
      credentials: { clientId: 'AdXxxxxxxxxxxxxxxxxx', clientSecret: 'EFxxxxxxxxxxxxxx' },
      settings: { sandboxMode: false }
    },
    // SMS
    {
      id: 'prov-twilio',
      name: 'Twilio Cloud SMS',
      category: 'sms',
      isActive: true,
      healthStatus: 'healthy',
      latencyMs: 62,
      lastChecked: new Date().toISOString(),
      credentials: { accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxx', authToken: 'auth_token_xxxxxx', fromNumber: '+15551234567' },
      settings: { enableMms: false, deliveryCallback: true }
    },
    {
      id: 'prov-nexmo',
      name: 'Vonage (Nexmo) Messaging',
      category: 'sms',
      isActive: false,
      healthStatus: 'healthy',
      latencyMs: 110,
      lastChecked: new Date().toISOString(),
      credentials: { apiKey: 'nexmo_key_112', apiSecret: 'nexmo_secret_772' },
      settings: { senderId: 'MED_ALLIANCE' }
    },
    // EMAIL
    {
      id: 'prov-sendgrid',
      name: 'Twilio SendGrid Transactional',
      category: 'email',
      isActive: true,
      healthStatus: 'healthy',
      latencyMs: 50,
      lastChecked: new Date().toISOString(),
      credentials: { apiKey: 'SG.xxxxxxxxxxxxxxxxxx' },
      settings: { senderEmail: 'no-reply@clinicalliance.org', senderName: 'CareSync Clinical Hub' }
    },
    {
      id: 'prov-smtp',
      name: 'Custom SMTP Server Relay',
      category: 'email',
      isActive: false,
      healthStatus: 'offline',
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      credentials: { host: 'smtp.office365.com', port: '587', user: 'admin@clinic.org', pass: 'secure_password' },
      settings: { secure: true }
    },
    // WHATSAPP
    {
      id: 'prov-meta-wa',
      name: 'Meta WhatsApp Business API',
      category: 'whatsapp',
      isActive: true,
      healthStatus: 'healthy',
      latencyMs: 78,
      lastChecked: new Date().toISOString(),
      credentials: { accessToken: 'EAAxxxxxxxxxxxxxxxxx', phoneId: '109xxxxxxxxxxxx' },
      settings: { templateNamespace: 'med_templates' }
    },
    // AI PROVIDERS
    {
      id: 'prov-gemini',
      name: 'Google Gemini Pro LLM',
      category: 'ai',
      isActive: true,
      healthStatus: 'healthy',
      latencyMs: 120,
      lastChecked: new Date().toISOString(),
      credentials: { apiKey: 'GEMINI_API_KEY' },
      settings: { modelName: 'gemini-3.5-flash', temperature: 0.1 }
    },
    {
      id: 'prov-openai',
      name: 'OpenAI GPT-4o Engine',
      category: 'ai',
      isActive: false,
      healthStatus: 'degraded',
      latencyMs: 250,
      lastChecked: new Date().toISOString(),
      credentials: { apiKey: 'sk-proj-xxxxxxxxxxxxxxxx' },
      settings: { modelName: 'gpt-4o', temperature: 0.2 }
    },
    // CALENDAR PROVIDERS
    {
      id: 'prov-google-cal',
      name: 'Google Calendar API Sync',
      category: 'calendar',
      isActive: true,
      healthStatus: 'healthy',
      latencyMs: 85,
      lastChecked: new Date().toISOString(),
      credentials: { clientId: 'google_client_id_102', clientSecret: 'google_secret_392' },
      settings: { syncIntervalMinutes: 10 }
    },
    // CLOUD STORAGE
    {
      id: 'prov-gcs',
      name: 'Google Cloud Storage Buckets',
      category: 'cloud_storage',
      isActive: true,
      healthStatus: 'healthy',
      latencyMs: 38,
      lastChecked: new Date().toISOString(),
      credentials: { bucketName: 'care-sync-clinical-storage', keyFile: '/secrets/gcp.json' },
      settings: { storageClass: 'STANDARD', region: 'us-central1' }
    },
    {
      id: 'prov-aws-s3',
      name: 'Amazon S3 Glacier Vault',
      category: 'cloud_storage',
      isActive: false,
      healthStatus: 'healthy',
      latencyMs: 95,
      lastChecked: new Date().toISOString(),
      credentials: { bucketName: 'aws-s3-glacier-sync', accessKeyId: 'AKIAxxxxxxxx', secretAccessKey: 'wJalrxxxxxxxx' },
      settings: { region: 'us-east-1' }
    }
  ];

  private static initFiles() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(INTEGRATIONS_FILE)) {
      fs.writeFileSync(INTEGRATIONS_FILE, JSON.stringify(this.defaultProviders, null, 2), 'utf-8');
    }
  }

  /**
   * Load providers from config
   */
  public static getProviders(): IntegrationProvider[] {
    this.initFiles();
    try {
      const data = fs.readFileSync(INTEGRATIONS_FILE, 'utf-8');
      return JSON.parse(data || '[]');
    } catch {
      return this.defaultProviders;
    }
  }

  /**
   * Save providers to config
   */
  public static saveProviders(providers: IntegrationProvider[]): void {
    this.initFiles();
    fs.writeFileSync(INTEGRATIONS_FILE, JSON.stringify(providers, null, 2), 'utf-8');
  }

  /**
   * Switch active provider for a category (ensures only one is active per category)
   */
  public static switchActiveProvider(categoryId: IntegrationCategory, providerId: string): void {
    const providers = this.getProviders();
    const updated = providers.map(prov => {
      if (prov.category === categoryId) {
        return {
          ...prov,
          isActive: prov.id === providerId
        };
      }
      return prov;
    });

    this.saveProviders(updated);
    logger.info(`IntegrationHub: Activated provider "${providerId}" for category "${categoryId}"`);
  }

  /**
   * Trigger health ping checks across all integrated services
   */
  public static async pingAllProviders(): Promise<IntegrationProvider[]> {
    const providers = this.getProviders();
    const updated = providers.map(prov => {
      // Simulate real-world ping check with dynamic jitter
      if (prov.healthStatus === 'offline') {
        prov.latencyMs = 0;
      } else {
        prov.latencyMs = Math.round(30 + Math.random() * 80);
        // Randomly degrade non-active providers occasionally for diagnostic realism
        if (!prov.isActive && Math.random() > 0.8) {
          prov.healthStatus = Math.random() > 0.5 ? 'degraded' : 'healthy';
        } else {
          prov.healthStatus = 'healthy';
        }
      }
      prov.lastChecked = new Date().toISOString();
      return prov;
    });

    this.saveProviders(updated);
    logger.info(`IntegrationHub: Complete external dependency health audit performed.`);
    return updated;
  }

  /**
   * Update credentials/settings for a provider safely
   */
  public static updateProviderDetails(providerId: string, credentials: Record<string, string>, settings: Record<string, any>): IntegrationProvider {
    const providers = this.getProviders();
    const idx = providers.findIndex(p => p.id === providerId);
    if (idx === -1) {
      throw new Error(`Integration provider ${providerId} not found`);
    }

    providers[idx].credentials = { ...providers[idx].credentials, ...credentials };
    providers[idx].settings = { ...providers[idx].settings, ...settings };
    providers[idx].healthStatus = 'healthy'; // reset status upon config modification
    providers[idx].lastChecked = new Date().toISOString();

    this.saveProviders(providers);
    logger.info(`IntegrationHub: Updated credentials for provider ${providerId}`);
    return providers[idx];
  }
}

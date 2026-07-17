import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { IntegrationHub, IntegrationCategory } from '../services/integrationHub.ts';

export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

// Get all integration providers
integrationsRouter.get('/', async (req, res, next) => {
  try {
    const providers = await IntegrationHub.getProviders();
    const sanitized = providers.map(p => ({
      ...p,
      credentials: IntegrationHub.maskCredentials(p.credentials)
    }));
    res.json(sanitized);
  } catch (error) {
    next(error);
  }
});

// Trigger complete active diagnostic ping audit
integrationsRouter.post('/ping', async (req, res, next) => {
  try {
    const audited = await IntegrationHub.pingAllProviders();
    const sanitized = audited.map(p => ({
      ...p,
      credentials: IntegrationHub.maskCredentials(p.credentials)
    }));
    res.json(sanitized);
  } catch (error) {
    next(error);
  }
});

// Switch active provider for a category
integrationsRouter.post('/switch', async (req, res, next) => {
  try {
    const { category, providerId } = req.body;
    if (!category || !providerId) {
      res.status(400).json({ error: 'Both category and providerId are required.' });
      return;
    }
    await IntegrationHub.switchActiveProvider(category as IntegrationCategory, providerId);
    res.json({ message: `Successfully switched active ${category} provider to ${providerId}.` });
  } catch (error) {
    next(error);
  }
});

// Update provider configuration & credentials
integrationsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { credentials, settings } = req.body;
    const updated = await IntegrationHub.updateProviderDetails(id, credentials || {}, settings || {});
    res.json({ 
      message: 'Configuration saved successfully', 
      data: {
        ...updated,
        credentials: IntegrationHub.maskCredentials(updated.credentials)
      } 
    });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

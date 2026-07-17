import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { IntegrationHub, IntegrationCategory } from '../services/integrationHub.ts';

export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

// Get all integration providers
integrationsRouter.get('/', (req, res, next) => {
  try {
    const providers = IntegrationHub.getProviders();
    res.json(providers);
  } catch (error) {
    next(error);
  }
});

// Trigger complete active diagnostic ping audit
integrationsRouter.post('/ping', async (req, res, next) => {
  try {
    const audited = await IntegrationHub.pingAllProviders();
    res.json(audited);
  } catch (error) {
    next(error);
  }
});

// Switch active provider for a category
integrationsRouter.post('/switch', (req, res, next) => {
  try {
    const { category, providerId } = req.body;
    if (!category || !providerId) {
      res.status(400).json({ error: 'Both category and providerId are required.' });
      return;
    }
    IntegrationHub.switchActiveProvider(category as IntegrationCategory, providerId);
    res.json({ message: `Successfully switched active ${category} provider to ${providerId}.` });
  } catch (error) {
    next(error);
  }
});

// Update provider configuration & credentials
integrationsRouter.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { credentials, settings } = req.body;
    const updated = IntegrationHub.updateProviderDetails(id, credentials || {}, settings || {});
    res.json({ message: 'Configuration saved successfully', data: updated });
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

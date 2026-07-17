import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { WorkflowEngine } from '../services/workflowEngine.ts';

export const workflowRouter = Router();

// Secure all endpoints with authentication
workflowRouter.use(requireAuth);

// Get all workflow templates
workflowRouter.get('/templates', (req, res, next) => {
  try {
    const templates = WorkflowEngine.getTemplates();
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// Create custom reusable workflow template
workflowRouter.post('/templates', (req, res, next) => {
  try {
    const { name, description, category, steps } = req.body;
    if (!name || !steps || !Array.isArray(steps)) {
      res.status(400).json({ error: 'Name and steps array are required' });
      return;
    }
    const id = `tmpl-${Date.now()}`;
    const newTpl = WorkflowEngine.addTemplate({ id, name, description, category, steps });
    res.status(210).json({ message: 'Workflow template registered', data: newTpl });
  } catch (error) {
    next(error);
  }
});

// Get all workflow instances
workflowRouter.get('/instances', async (req, res, next) => {
  try {
    const instances = await WorkflowEngine.getInstances();
    res.json(instances);
  } catch (error) {
    next(error);
  }
});

// Start workflow instance
workflowRouter.post('/instances', async (req, res, next) => {
  try {
    const { templateId, name, variables } = req.body;
    const userDisplayName = (req as any).user?.name || 'Administrator';
    if (!templateId) {
      res.status(400).json({ error: 'Template ID is required to instantiate workflow' });
      return;
    }
    const instance = await WorkflowEngine.startWorkflow(templateId, name, userDisplayName, variables || {});
    res.status(201).json(instance);
  } catch (error) {
    next(error);
  }
});

// Approve or complete a manual task
workflowRouter.post('/instances/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stepId, approved, notes } = req.body;
    const userDisplayName = (req as any).user?.name || 'Administrator';

    if (!stepId) {
      res.status(400).json({ error: 'Step ID is required to process approval' });
      return;
    }

    const updatedInstance = await WorkflowEngine.approveOrCompleteStep(id, stepId, userDisplayName, approved !== false, notes);
    res.json(updatedInstance);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Escalate step manually due to timeout or urgency
workflowRouter.post('/instances/:id/escalate', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stepId } = req.body;
    const userDisplayName = (req as any).user?.name || 'Administrator';

    if (!stepId) {
      res.status(400).json({ error: 'Step ID is required to process escalation' });
      return;
    }

    const updatedInstance = await WorkflowEngine.triggerEscalation(id, stepId, userDisplayName);
    res.json(updatedInstance);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

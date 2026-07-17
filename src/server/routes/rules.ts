import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { RuleEngine, BusinessRule } from '../services/ruleEngine.ts';

export const rulesRouter = Router();

rulesRouter.use(requireAuth);

// Get all business rules
rulesRouter.get('/', async (req, res, next) => {
  try {
    const rules = await RuleEngine.getRules();
    res.json(rules);
  } catch (error) {
    next(error);
  }
});

// Create/Update a business rule
rulesRouter.post('/', async (req, res, next) => {
  try {
    const newRule: BusinessRule = req.body;
    if (!newRule.name || !newRule.category || !Array.isArray(newRule.conditions) || !Array.isArray(newRule.actions)) {
      res.status(400).json({ error: 'Name, category, conditions, and actions are required fields.' });
      return;
    }

    const rules = await RuleEngine.getRules();
    const existingIndex = rules.findIndex(r => r.id === newRule.id);

    if (existingIndex !== -1) {
      rules[existingIndex] = { ...rules[existingIndex], ...newRule };
    } else {
      newRule.id = newRule.id || `rule-${Date.now()}`;
      rules.unshift(newRule);
    }

    await RuleEngine.saveRules(rules);
    res.json({ message: 'Business rule persisted successfully', data: newRule });
  } catch (error) {
    next(error);
  }
});

// Toggle rule enablement state
rulesRouter.post('/:id/toggle', async (req, res, next) => {
  try {
    const { id } = req.params;
    const rules = await RuleEngine.getRules();
    const rule = rules.find(r => r.id === id);
    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    rule.enabled = !rule.enabled;
    await RuleEngine.saveRules(rules);
    res.json({ message: `Rule status toggled to ${rule.enabled ? 'ENABLED' : 'DISABLED'}`, data: rule });
  } catch (error) {
    next(error);
  }
});

// Delete a business rule
rulesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const rules = await RuleEngine.getRules();
    const filtered = rules.filter(r => r.id !== id);
    await RuleEngine.saveRules(filtered);
    res.json({ message: 'Business rule deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Test / Simulate a rule set against a mock payload
rulesRouter.post('/simulate', async (req, res, next) => {
  try {
    const { category, payload } = req.body;
    if (!category || !payload) {
      res.status(400).json({ error: 'Category and test payload are required for simulation.' });
      return;
    }
    const result = await RuleEngine.executeRules(category, payload);
    res.json({
      original: payload,
      evaluated: result
    });
  } catch (error) {
    next(error);
  }
});

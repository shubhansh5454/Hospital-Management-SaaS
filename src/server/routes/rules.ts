import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { RuleEngine, BusinessRule } from '../services/ruleEngine.ts';

export const rulesRouter = Router();

rulesRouter.use(requireAuth);

// Get all business rules
rulesRouter.get('/', (req, res, next) => {
  try {
    const rules = RuleEngine.getRules();
    res.json(rules);
  } catch (error) {
    next(error);
  }
});

// Create/Update a business rule
rulesRouter.post('/', (req, res, next) => {
  try {
    const newRule: BusinessRule = req.body;
    if (!newRule.name || !newRule.category || !Array.isArray(newRule.conditions) || !Array.isArray(newRule.actions)) {
      res.status(400).json({ error: 'Name, category, conditions, and actions are required fields.' });
      return;
    }

    const rules = RuleEngine.getRules();
    const existingIndex = rules.findIndex(r => r.id === newRule.id);

    if (existingIndex !== -1) {
      rules[existingIndex] = { ...rules[existingIndex], ...newRule };
    } else {
      newRule.id = newRule.id || `rule-${Date.now()}`;
      rules.unshift(newRule);
    }

    RuleEngine.saveRules(rules);
    res.json({ message: 'Business rule persisted successfully', data: newRule });
  } catch (error) {
    next(error);
  }
});

// Toggle rule enablement state
rulesRouter.post('/:id/toggle', (req, res, next) => {
  try {
    const { id } = req.params;
    const rules = RuleEngine.getRules();
    const rule = rules.find(r => r.id === id);
    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    rule.enabled = !rule.enabled;
    RuleEngine.saveRules(rules);
    res.json({ message: `Rule status toggled to ${rule.enabled ? 'ENABLED' : 'DISABLED'}`, data: rule });
  } catch (error) {
    next(error);
  }
});

// Delete a business rule
rulesRouter.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const rules = RuleEngine.getRules();
    const filtered = rules.filter(r => r.id !== id);
    RuleEngine.saveRules(filtered);
    res.json({ message: 'Business rule deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Test / Simulate a rule set against a mock payload
rulesRouter.post('/simulate', (req, res, next) => {
  try {
    const { category, payload } = req.body;
    if (!category || !payload) {
      res.status(400).json({ error: 'Category and test payload are required for simulation.' });
      return;
    }
    const result = RuleEngine.executeRules(category, payload);
    res.json({
      original: payload,
      evaluated: result
    });
  } catch (error) {
    next(error);
  }
});

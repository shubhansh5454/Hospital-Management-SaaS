import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.ts';

export interface RuleCondition {
  field: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals' | 'contains' | 'matches';
  value: string; // The comparison value, e.g., '65', 'Medicare', 'HIGH'
}

export interface RuleAction {
  targetField: string;
  actionType: 'set_value' | 'apply_discount_percentage' | 'trigger_alert' | 'calculate_formula';
  value: string; // E.g., '0.15', 'CRITICAL_ALERT', 'baseAmount * 1.25'
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  category: 'billing' | 'appointment' | 'pharmacy' | 'laboratory' | 'clinical' | 'validation';
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number; // Rules sorted and executed by priority
}

const DATA_DIR = path.join(process.cwd(), 'src', 'server', 'data');
const RULES_FILE = path.join(DATA_DIR, 'business_rules.json');

export class RuleEngine {
  private static defaultRules: BusinessRule[] = [
    {
      id: 'rule-senior-discount',
      name: 'Senior Patient Billing Waiver',
      description: 'Applies a automatic 15% discount on consultation fees for elderly patients over the age of 65.',
      category: 'billing',
      enabled: true,
      priority: 10,
      conditions: [
        { field: 'age', operator: 'greater_than', value: '65' }
      ],
      actions: [
        { targetField: 'discountPercentage', actionType: 'apply_discount_percentage', value: '15' },
        { targetField: 'appliedRuleId', actionType: 'set_value', value: 'rule-senior-discount' }
      ]
    },
    {
      id: 'rule-medicare-copay',
      name: 'Medicare Zero Copay Waiver',
      description: 'Overrides appointment and clinical billing copay to $0 if the patient is under Medicare insurance coverage.',
      category: 'billing',
      enabled: true,
      priority: 20,
      conditions: [
        { field: 'insuranceProvider', operator: 'equals', value: 'Medicare' }
      ],
      actions: [
        { targetField: 'copayAmount', actionType: 'set_value', value: '0' },
        { targetField: 'notes', actionType: 'set_value', value: 'Approved under Medicare Waiver Scheme.' }
      ]
    },
    {
      id: 'rule-critical-potassium',
      name: 'Critical Hyperkalemia Laboratory Alert',
      description: 'Triggers a critical system flag and automated notification if Potassium (K+) blood level exceeds 5.5 mEq/L.',
      category: 'laboratory',
      enabled: true,
      priority: 5,
      conditions: [
        { field: 'potassium', operator: 'greater_than', value: '5.5' }
      ],
      actions: [
        { targetField: 'alertLevel', actionType: 'trigger_alert', value: 'CRITICAL_HIGH' },
        { targetField: 'autoEscalate', actionType: 'set_value', value: 'true' }
      ]
    },
    {
      id: 'rule-reorder-stock',
      name: 'Automated Pharmacy Reorder Level',
      description: 'Triggers an automated supplier reorder purchase draft if current pharmacy stock levels drop below reorder threshold.',
      category: 'pharmacy',
      enabled: true,
      priority: 15,
      conditions: [
        { field: 'stockCount', operator: 'less_than', value: 'reorderLevel' }
      ],
      actions: [
        { targetField: 'reorderTriggered', actionType: 'set_value', value: 'true' },
        { targetField: 'draftQuantity', actionType: 'calculate_formula', value: 'reorderLevel * 2' }
      ]
    }
  ];

  private static async initFiles() {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(RULES_FILE)) {
      await fs.promises.writeFile(RULES_FILE, JSON.stringify(this.defaultRules, null, 2), 'utf-8');
    }
  }

  /**
   * Fetch all business rules from database/JSON
   */
  public static async getRules(): Promise<BusinessRule[]> {
    await this.initFiles();
    try {
      const data = await fs.promises.readFile(RULES_FILE, 'utf-8');
      return JSON.parse(data || '[]');
    } catch {
      return this.defaultRules;
    }
  }

  /**
   * Save rule set
   */
  public static async saveRules(rules: BusinessRule[]): Promise<void> {
    await this.initFiles();
    await fs.promises.writeFile(RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8');
  }

  /**
   * Execute business rules against a dynamic context payload
   */
  public static async executeRules(category: string, context: Record<string, any>): Promise<Record<string, any>> {
    const rules = (await this.getRules())
      .filter(r => r.enabled && r.category === category)
      .sort((a, b) => b.priority - a.priority); // Execute higher priority rules first

    const output = { ...context };
    logger.info(`RuleEngine: Evaluating ${rules.length} active rules for category "${category}"`);

    for (const rule of rules) {
      let conditionsMet = true;

      for (const cond of rule.conditions) {
        const contextVal = context[cond.field];
        let compareVal = cond.value;

        // Resolve dynamic comparisons (e.g., comparing field 'stockCount' to field 'reorderLevel')
        if (context[cond.value] !== undefined) {
          compareVal = context[cond.value];
        }

        if (contextVal === undefined) {
          conditionsMet = false;
          break;
        }

        const numericContextVal = Number(contextVal);
        const numericCompareVal = Number(compareVal);

        const isNumeric = !isNaN(numericContextVal) && !isNaN(numericCompareVal);

        switch (cond.operator) {
          case 'greater_than':
            if (isNumeric) {
              conditionsMet = conditionsMet && (numericContextVal > numericCompareVal);
            } else {
              conditionsMet = conditionsMet && (String(contextVal) > String(compareVal));
            }
            break;
          case 'less_than':
            if (isNumeric) {
              conditionsMet = conditionsMet && (numericContextVal < numericCompareVal);
            } else {
              conditionsMet = conditionsMet && (String(contextVal) < String(compareVal));
            }
            break;
          case 'equals':
            conditionsMet = conditionsMet && (String(contextVal).trim().toLowerCase() === String(compareVal).trim().toLowerCase());
            break;
          case 'not_equals':
            conditionsMet = conditionsMet && (String(contextVal).trim().toLowerCase() !== String(compareVal).trim().toLowerCase());
            break;
          case 'contains':
            conditionsMet = conditionsMet && String(contextVal).toLowerCase().includes(String(compareVal).toLowerCase());
            break;
          case 'matches':
            try {
              const regex = new RegExp(String(compareVal), 'i');
              conditionsMet = conditionsMet && regex.test(String(contextVal));
            } catch {
              conditionsMet = false;
            }
            break;
          default:
            conditionsMet = false;
        }

        if (!conditionsMet) break;
      }

      if (conditionsMet) {
        logger.info(`RuleEngine: Rule "${rule.name}" triggered and matched context`);
        
        // Execute Actions
        for (const act of rule.actions) {
          let resolvedValue: any = act.value;

          if (act.actionType === 'apply_discount_percentage') {
            const percentage = Number(act.value);
            if (output.totalAmount !== undefined && !isNaN(output.totalAmount)) {
              const discount = (Number(output.totalAmount) * percentage) / 100;
              output.discountAmount = (output.discountAmount || 0) + discount;
              output.totalAmount = Math.max(0, Number(output.totalAmount) - discount);
            }
          } 
          else if (act.actionType === 'calculate_formula') {
            // Evaluates simple formula expressions safely (e.g. "reorderLevel * 2")
            try {
              const formula = act.value;
              const parts = formula.split(/\s*([\*\+\-\/])\s*/);
              if (parts.length === 3) {
                const leftOperand = output[parts[0]] !== undefined ? Number(output[parts[0]]) : Number(parts[0]);
                const op = parts[1];
                const rightOperand = output[parts[2]] !== undefined ? Number(output[parts[2]]) : Number(parts[2]);

                if (!isNaN(leftOperand) && !isNaN(rightOperand)) {
                  if (op === '*') resolvedValue = leftOperand * rightOperand;
                  else if (op === '+') resolvedValue = leftOperand + rightOperand;
                  else if (op === '-') resolvedValue = leftOperand - rightOperand;
                  else if (op === '/') resolvedValue = rightOperand !== 0 ? leftOperand / rightOperand : 0;
                }
              }
            } catch (err) {
              logger.error(`RuleEngine formula execution failed:`, err);
            }
            output[act.targetField] = resolvedValue;
          } 
          else {
            // E.g., set_value or trigger_alert
            output[act.targetField] = act.value;
          }
        }
      }
    }

    return output;
  }
}

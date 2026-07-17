import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.ts';
import { NotificationService } from './notification.ts';

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'automatic' | 'approval' | 'manual_action' | 'condition';
  assignedRole?: string; // e.g. 'doctor', 'admin', 'billing_officer'
  assignedUserId?: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'SKIPPED';
  completedBy?: string;
  completedAt?: string;
  escalationHours?: number;
  escalatedTo?: string;
  escalatedAt?: string;
  conditionExpression?: string; // e.g. "totalAmount > 5000"
  nextStepIdSuccess?: string;
  nextStepIdFailure?: string;
  nextStepIdDefault?: string;
  notes?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'clinical' | 'billing' | 'laboratory' | 'pharmacy';
  steps: WorkflowStep[];
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  name: string;
  status: 'RUNNING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
  currentStepId: string;
  variables: Record<string, any>; // context values like totalAmount, doctorSpecialty
  history: {
    timestamp: string;
    action: string;
    operator: string;
    details: string;
  }[];
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'src', 'server', 'data');
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');

export class WorkflowEngine {
  private static templates: WorkflowTemplate[] = [
    {
      id: 'tmpl-billing-approval',
      name: 'High-Value Billing Claim Approval',
      description: 'Orchestrates validation, billing manager review, and automatic insurance routing for bills exceeding $5,000.',
      category: 'billing',
      steps: [
        {
          id: 'step-auto-init',
          name: 'Initialize Claim Scan',
          type: 'automatic',
          status: 'PENDING',
          nextStepIdDefault: 'step-amount-check'
        },
        {
          id: 'step-amount-check',
          name: 'Verify High Value Limit (>=$5,000)',
          type: 'condition',
          status: 'PENDING',
          conditionExpression: 'totalAmount >= 5000',
          nextStepIdSuccess: 'step-billing-manager-approval',
          nextStepIdFailure: 'step-auto-approve-low'
        },
        {
          id: 'step-billing-manager-approval',
          name: 'Billing Department Manager Approval',
          type: 'approval',
          assignedRole: 'admin',
          status: 'PENDING',
          escalationHours: 24,
          escalatedTo: 'superadmin',
          nextStepIdDefault: 'step-insurance-submission'
        },
        {
          id: 'step-insurance-submission',
          name: 'Submit Insurance pre-auth claims',
          type: 'manual_action',
          assignedRole: 'receptionist',
          status: 'PENDING',
          nextStepIdDefault: 'step-complete-high'
        },
        {
          id: 'step-complete-high',
          name: 'Mark Claim Approved & Closed',
          type: 'automatic',
          status: 'PENDING'
        },
        {
          id: 'step-auto-approve-low',
          name: 'Auto-Approve Low Value Claim',
          type: 'automatic',
          status: 'PENDING'
        }
      ]
    },
    {
      id: 'tmpl-lab-escalation',
      name: 'Critical Lab Alert Protocol',
      description: 'Ensures critical lab findings are automatically escalated from lab technician to duty doctor and chief medical officer.',
      category: 'laboratory',
      steps: [
        {
          id: 'step-lab-init',
          name: 'Flag Critical Lab Result',
          type: 'automatic',
          status: 'PENDING',
          nextStepIdDefault: 'step-doctor-alert'
        },
        {
          id: 'step-doctor-alert',
          name: 'Duty Doctor Diagnosis Approval',
          type: 'approval',
          assignedRole: 'doctor',
          status: 'PENDING',
          escalationHours: 2,
          escalatedTo: 'chief_medical_officer',
          nextStepIdDefault: 'step-notify-patient'
        },
        {
          id: 'step-notify-patient',
          name: 'Notify Patient Urgent Consultation',
          type: 'manual_action',
          assignedRole: 'receptionist',
          status: 'PENDING',
          nextStepIdDefault: 'step-complete-critical'
        },
        {
          id: 'step-complete-critical',
          name: 'Log Alert Protocol as Resolved',
          type: 'automatic',
          status: 'PENDING'
        }
      ]
    }
  ];

  private static async initFiles() {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(WORKFLOWS_FILE)) {
      await fs.promises.writeFile(WORKFLOWS_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  public static getTemplates(): WorkflowTemplate[] {
    return this.templates;
  }

  public static addTemplate(tpl: WorkflowTemplate): WorkflowTemplate {
    this.templates.push(tpl);
    return tpl;
  }

  public static async getInstances(): Promise<WorkflowInstance[]> {
    await this.initFiles();
    try {
      const data = await fs.promises.readFile(WORKFLOWS_FILE, 'utf-8');
      return JSON.parse(data || '[]');
    } catch {
      return [];
    }
  }

  private static async saveInstances(instances: WorkflowInstance[]) {
    await this.initFiles();
    await fs.promises.writeFile(WORKFLOWS_FILE, JSON.stringify(instances, null, 2), 'utf-8');
  }

  /**
   * Start a new workflow instance from a template
   */
  public static async startWorkflow(templateId: string, name: string, creator: string, variables: Record<string, any> = {}): Promise<WorkflowInstance> {
    const templates = this.getTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Workflow template with ID ${templateId} not found`);
    }

    const instances = await this.getInstances();
    const deepCopiedSteps: WorkflowStep[] = JSON.parse(JSON.stringify(template.steps));

    const newInstance: WorkflowInstance = {
      id: `wfi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      templateId,
      name: name || template.name,
      status: 'RUNNING',
      currentStepId: deepCopiedSteps[0]?.id || '',
      variables,
      history: [
        {
          timestamp: new Date().toISOString(),
          action: 'STARTED',
          operator: creator,
          details: `Workflow instance initialized from template: ${template.name}`
        }
      ],
      steps: deepCopiedSteps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    instances.unshift(newInstance);

    // Trigger step execution in memory before writing to disk
    this.executeWorkflowStepInternal(instances, newInstance.id, creator);

    await this.saveInstances(instances);

    return instances.find(i => i.id === newInstance.id) || newInstance;
  }

  /**
   * Process and execute current step asynchronously with zero redundant I/O
   */
  public static async executeCurrentStep(instanceId: string, operator: string): Promise<void> {
    const instances = await this.getInstances();
    this.executeWorkflowStepInternal(instances, instanceId, operator);
    await this.saveInstances(instances);
  }

  /**
   * Internal recursive helper that performs step transitions entirely in memory.
   * File I/O is deferred until the entire cascade of automatic/condition steps is finished.
   */
  private static executeWorkflowStepInternal(instances: WorkflowInstance[], instanceId: string, operator: string): void {
    const instIdx = instances.findIndex(i => i.id === instanceId);
    if (instIdx === -1) return;

    const inst = instances[instIdx];
    if (inst.status !== 'RUNNING') return;

    const step = inst.steps.find(s => s.id === inst.currentStepId);
    if (!step) {
      logger.warn(`WorkflowEngine: currentStepId "${inst.currentStepId}" not found in instance ${inst.id}`);
      return;
    }

    step.status = 'ACTIVE';

    if (step.type === 'automatic') {
      logger.info(`WorkflowEngine: Executing auto step "${step.name}" in instance ${inst.id}`);
      step.status = 'COMPLETED';
      step.completedBy = 'System Orchestrator';
      step.completedAt = new Date().toISOString();
      inst.history.push({
        timestamp: new Date().toISOString(),
        action: 'STEP_COMPLETED',
        operator: 'System Orchestrator',
        details: `Automatically executed and completed step: ${step.name}`
      });

      this.transitionToNext(inst, step, 'success', operator);

      // Re-trigger execution recursively in memory for automatic cascading
      this.executeWorkflowStepInternal(instances, instanceId, operator);
    } 
    else if (step.type === 'condition') {
      logger.info(`WorkflowEngine: Evaluating condition step "${step.name}" in instance ${inst.id}`);
      
      let conditionMet = false;
      try {
        if (step.conditionExpression) {
          // Robust, safe parser for simple variable comparisons (e.g., totalAmount >= 5000)
          const expr = step.conditionExpression;
          const match = expr.match(/([a-zA-Z0-9_]+)\s*(>=|<=|>|<|==|!=)\s*([a-zA-Z0-9_]+)/);
          if (match) {
            const [_, varName, operatorSymbol, valStr] = match;
            const variableVal = inst.variables[varName];
            const compareVal = isNaN(Number(valStr)) ? valStr : Number(valStr);

            if (variableVal !== undefined) {
              if (operatorSymbol === '>=') conditionMet = Number(variableVal) >= Number(compareVal);
              else if (operatorSymbol === '<=') conditionMet = Number(variableVal) <= Number(compareVal);
              else if (operatorSymbol === '>') conditionMet = Number(variableVal) > Number(compareVal);
              else if (operatorSymbol === '<') conditionMet = Number(variableVal) < Number(compareVal);
              else if (operatorSymbol === '==') conditionMet = String(variableVal) === String(compareVal);
              else if (operatorSymbol === '!=') conditionMet = String(variableVal) !== String(compareVal);
            }
          }
        }
      } catch (err) {
        logger.error(`WorkflowEngine condition execution failed:`, err);
      }

      step.status = 'COMPLETED';
      step.completedBy = 'System Rules Engine';
      step.completedAt = new Date().toISOString();
      step.notes = conditionMet ? 'Condition evaluating to TRUE' : 'Condition evaluating to FALSE';

      inst.history.push({
        timestamp: new Date().toISOString(),
        action: 'CONDITION_EVALUATED',
        operator: 'System Rules Engine',
        details: `Step: ${step.name}. Evaluated Expression: "${step.conditionExpression}". Outcome: ${conditionMet ? 'TRUE' : 'FALSE'}`
      });

      this.transitionToNext(inst, step, conditionMet ? 'success' : 'failure', operator);

      // Re-trigger recursively in memory
      this.executeWorkflowStepInternal(instances, instanceId, operator);
    } 
    else {
      // Manual action or Approval steps await human intervention. Trigger notifications.
      logger.info(`WorkflowEngine: Awaiting manual completion/approval for step "${step.name}" in instance ${inst.id}`);
      
      // Dispatch alert notification to assigned role
      if (step.assignedRole) {
        try {
          NotificationService.sendNotification({
            title: `Workflow Action Needed: ${step.name}`,
            message: `The workflow "${inst.name}" is pending action on step "${step.name}". Assigned to role: ${step.assignedRole}.`,
            type: 'GENERAL',
            channels: ['IN_APP']
          }).catch(() => {});
        } catch {
          // Fallback if NotificationService is offline during tests/seeding
        }
      }
    }
  }

  /**
   * Complete or Approve a step manually
   */
  public static async approveOrCompleteStep(instanceId: string, stepId: string, operator: string, approved: boolean = true, notes?: string): Promise<WorkflowInstance> {
    const instances = await this.getInstances();
    const instIdx = instances.findIndex(i => i.id === instanceId);
    if (instIdx === -1) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    const inst = instances[instIdx];
    if (inst.status !== 'RUNNING') {
      throw new Error(`Workflow is not active`);
    }

    const step = inst.steps.find(s => s.id === stepId);
    if (!step || inst.currentStepId !== stepId) {
      throw new Error(`Step ${stepId} is not the current active step`);
    }

    step.status = approved ? 'COMPLETED' : 'REJECTED';
    step.completedBy = operator;
    step.completedAt = new Date().toISOString();
    step.notes = notes;

    inst.history.push({
      timestamp: new Date().toISOString(),
      action: approved ? 'STEP_APPROVED' : 'STEP_REJECTED',
      operator,
      details: `${approved ? 'Approved' : 'Rejected'} step "${step.name}". Notes: ${notes || 'None'}`
    });

    if (!approved) {
      // Rejecting terminates the whole workflow instantly
      inst.status = 'REJECTED';
      inst.history.push({
        timestamp: new Date().toISOString(),
        action: 'WORKFLOW_REJECTED',
        operator,
        details: `Workflow rejected and aborted at step: ${step.name}`
      });
    } else {
      this.transitionToNext(inst, step, 'success', operator);
    }

    if (inst.status === 'RUNNING') {
      this.executeWorkflowStepInternal(instances, instanceId, operator);
    }

    await this.saveInstances(instances);

    return instances.find(i => i.id === instanceId) || inst;
  }

  /**
   * Handle step escalations (Simulates timers expiring)
   */
  public static async triggerEscalation(instanceId: string, stepId: string, operator: string): Promise<WorkflowInstance> {
    const instances = await this.getInstances();
    const instIdx = instances.findIndex(i => i.id === instanceId);
    if (instIdx === -1) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    const inst = instances[instIdx];
    const step = inst.steps.find(s => s.id === stepId);
    if (!step || step.status !== 'ACTIVE') {
      throw new Error(`Step is not active for escalation`);
    }

    const originalAssignee = step.assignedRole;
    step.status = 'ACTIVE';
    step.escalatedTo = step.escalatedTo || 'superadmin';
    step.escalatedAt = new Date().toISOString();
    step.notes = `ESCALATED: Exceeded action SLAs. Escalated to ${step.escalatedTo}.`;

    inst.history.push({
      timestamp: new Date().toISOString(),
      action: 'STEP_ESCALATED',
      operator: 'System SLA Monitor',
      details: `Step "${step.name}" breached deadline SLA. Escalated assignee from "${originalAssignee}" to Chief Administrator.`
    });

    try {
      NotificationService.sendNotification({
        title: `⚠️ SLA Breach Escalation: ${step.name}`,
        message: `The workflow step "${step.name}" in instance "${inst.name}" was escalated to you due to SLA timeout.`,
        type: 'GENERAL',
        channels: ['IN_APP']
      }).catch(() => {});
    } catch {
      // Catch silences
    }

    await this.saveInstances(instances);
    return inst;
  }

  /**
   * Progress state to next step in sequence
   */
  private static transitionToNext(inst: WorkflowInstance, currentStep: WorkflowStep, branch: 'success' | 'failure' | 'default', operator: string) {
    let nextId = currentStep.nextStepIdDefault;
    if (branch === 'success' && currentStep.nextStepIdSuccess) {
      nextId = currentStep.nextStepIdSuccess;
    } else if (branch === 'failure' && currentStep.nextStepIdFailure) {
      nextId = currentStep.nextStepIdFailure;
    }

    if (!nextId) {
      // No next step means workflow successfully finished
      inst.status = 'COMPLETED';
      inst.history.push({
        timestamp: new Date().toISOString(),
        action: 'WORKFLOW_COMPLETED',
        operator: 'System Orchestrator',
        details: 'Workflow processed all steps and reached terminal node successfully.'
      });
      inst.currentStepId = '';
    } else {
      inst.currentStepId = nextId;
      inst.history.push({
        timestamp: new Date().toISOString(),
        action: 'TRANSITIONED',
        operator: 'System Orchestrator',
        details: `Moving from step "${currentStep.name}" to next target: "${nextId}"`
      });
    }
  }
}

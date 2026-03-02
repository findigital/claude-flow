/**
 * ARGUS AI Governance & Strategy Agent
 *
 * Researches the organization's AI governance posture, use cases, adoption
 * maturity, and operational readiness. Applies the Harvard AGENT Framework
 * (Audit, Gauge, Engineer, Navigate, Track) to design an AI operational layer.
 *
 * Model routing:
 *   sonar               — factual AI policy/use case lookup
 *   sonar-reasoning-pro — AGENT framework analysis (multi-step CoT)
 */

import type {
  AgentResult, AIGovernanceIntelligence, AGENTFramework,
  AIUseCase, AuditConfig,
} from '../types.js';
import { PerplexityClient } from '../perplexity-client.js';
import { ClaudeClient } from '../claude-client.js';

export class GovernanceAgent {
  private pplx: PerplexityClient;
  private claude: ClaudeClient;
  private config: AuditConfig;

  constructor(pplx: PerplexityClient, claude: ClaudeClient, config: AuditConfig) {
    this.pplx = pplx;
    this.claude = claude;
    this.config = config;
  }

  async execute(): Promise<AgentResult<AIGovernanceIntelligence>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const allSources: string[] = [];

    console.log(`[GOV] Researching AI governance and operational maturity for ${this.config.orgName}...`);

    let intel: AIGovernanceIntelligence = this.emptyIntel();

    try {
      console.log('[GOV] Phase 1 — AI governance policies and use cases via sonar...');
      const govFacts = await this.pplx.quickSearch(
        `${this.config.orgName} (${this.config.targetUrl}) AI governance: ` +
        `What are their AI ethics policies, responsible AI guidelines, or AI governance frameworks? ` +
        `What specific AI use cases have they deployed or announced? ` +
        `What is their AI adoption maturity — are they exploring, piloting, or scaling AI? ` +
        `Do they have a Chief AI Officer, AI Center of Excellence, or dedicated AI team? ` +
        `What AI best practices or standards do they follow (NIST AI RMF, EU AI Act, ISO 42001)?`
      );
      allSources.push(...govFacts.citations);

      console.log('[GOV] Phase 2 — AI operational strategy via sonar-reasoning-pro...');
      const opStrategy = await this.pplx.analyze(
        `Analyze ${this.config.orgName}'s approach to building an AI operational layer: ` +
        `(1) What workflows or business processes has ${this.config.orgName} automated or augmented with AI? ` +
        `(2) How does ${this.config.orgName} handle human-AI collaboration in their products? ` +
        `(3) What is their approach to AI model deployment, monitoring, and iteration? ` +
        `(4) What AI infrastructure (MLOps, model registry, feature stores) do they use? ` +
        `(5) How do they measure AI ROI and track AI project outcomes?`
      );
      allSources.push(...opStrategy.citations);

      intel.currentMaturity = govFacts.content.slice(0, 1500);
      intel.governancePolicies = this.extractSection(govFacts.content, /governance|policy|ethics|responsible/i);
      intel.aiUseCases = this.extractUseCases(govFacts.content, opStrategy.content);
      intel.adoptionApproach = opStrategy.content.slice(0, 1500);
      intel.operationalReadiness = this.extractSection(opStrategy.content, /operational|MLOps|deploy|monitor/i);
      intel.bestPractices = this.extractBestPractices(govFacts.content);
      intel.sources = [...new Set(allSources)];

      // Phase 3: Generate AGENT framework via Claude
      if (this.claude.isAvailable) {
        console.log('[GOV] Phase 3 — Generating AGENT Framework via Claude...');
        intel.agentFramework = await this.generateAGENTFramework(
          govFacts.content, opStrategy.content
        );
      }
    } catch (e) {
      errors.push(`Governance error: ${e}`);
      console.error(`[GOV] Error: ${e}`);
    }

    console.log(`[GOV] Complete — ${intel.aiUseCases.length} AI use cases identified`);

    return {
      agentId: 'gov-001',
      agentType: 'governance',
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      status: errors.length > 0 ? 'partial' : 'success',
      data: intel,
      sources: [...new Set(allSources)],
      errors,
    };
  }

  private async generateAGENTFramework(
    govContent: string,
    opContent: string
  ): Promise<AGENTFramework> {
    const prompt = `You are filling out the Harvard AGENT Framework (Audit, Gauge, Engineer, Navigate, Track) for ${this.config.orgName} based on research findings.

RESEARCH DATA:
${govContent.slice(0, 3000)}

${opContent.slice(0, 3000)}

Generate a complete AGENT Framework analysis as JSON. Pick the MOST IMPORTANT AI workflow this organization uses (or should use) and map it through all 5 phases.

Return ONLY valid JSON matching this structure:
{
  "audit": {
    "workflowName": "Name of the primary AI workflow",
    "trigger": "What initiates this workflow",
    "steps": [
      {"name": "Step name", "overview": "Description", "objective": "Goal", "roles": "Who does this", "data": "Data sources", "systems": "Systems used", "output": "What this produces"}
    ],
    "finalOutput": "What the completed workflow delivers"
  },
  "gauge": {
    "expectedOutcome": "Target outcome description",
    "assessments": [
      {"stepName": "Step name", "impactScore": 4, "repeatabilityScore": 5, "complexityScore": 3, "notes": "Context for scores"}
    ]
  },
  "engineer": {
    "redesignMap": [
      {"stepName": "Step name", "agentAction": true, "humanAction": false, "rationale": "Why"}
    ],
    "challenges": [
      {"stepName": "Step name", "challenge": "Current problem", "agentSolution": "How AI solves it"}
    ],
    "processRefactoring": {
      "blockers": ["Current blocker 1"],
      "removalStrategies": ["How to remove it"],
      "refactoredSteps": ["How steps change"]
    },
    "designSpecs": {
      "agentRoles": "Agent types needed",
      "orchestrationArchitecture": "How agents coordinate",
      "keyInputs": "Required data inputs",
      "actions": "Agent actions and tools",
      "outputs": "Deliverables"
    }
  },
  "navigate": {
    "interactions": [
      {"stepName": "Step name", "humanRole": "What human does", "agentRole": "What agent does", "interactionType": "How they collaborate"}
    ],
    "transparency": "How agent decisions are explained",
    "interventionPaths": "When humans step in",
    "governance": "Oversight mechanisms",
    "roleRedefinition": "How roles change",
    "trainingNeeds": "What people need to learn"
  },
  "track": {
    "desiredOutcome": "Target state",
    "successSignals": ["Observable signal 1", "Observable signal 2"],
    "metrics": ["Metric 1", "Metric 2"]
  },
  "executiveSummary": "2-3 paragraph summary of the transformation journey and expected value"
}`;

    const raw = await this.claude.analyze(prompt, undefined, 6000);

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as AGENTFramework;
      }
    } catch {
      console.warn('[GOV] Failed to parse AGENT framework JSON, using fallback');
    }

    return this.fallbackFramework();
  }

  private extractUseCases(govContent: string, opContent: string): AIUseCase[] {
    const combined = govContent + '\n' + opContent;
    const cases: AIUseCase[] = [];
    const lines = combined.split('\n');

    const useCasePatterns = [
      { p: /(?:fraud\s+detection|anomaly\s+detection)/i, domain: 'Risk & Compliance' },
      { p: /(?:customer\s+(?:service|support)|chatbot|virtual\s+assistant)/i, domain: 'Customer Experience' },
      { p: /(?:predictive\s+(?:maintenance|analytics))/i, domain: 'Operations' },
      { p: /(?:content\s+generation|copywriting|marketing\s+AI)/i, domain: 'Marketing' },
      { p: /(?:code\s+generation|developer\s+tools|copilot)/i, domain: 'Engineering' },
      { p: /(?:supply\s+chain|logistics|inventory)/i, domain: 'Supply Chain' },
      { p: /(?:drug\s+discovery|clinical|diagnosis)/i, domain: 'Healthcare' },
      { p: /(?:underwriting|claims|risk\s+(?:model|score))/i, domain: 'Insurance/Finance' },
      { p: /(?:document\s+(?:processing|extraction)|OCR)/i, domain: 'Document Intelligence' },
      { p: /(?:recommendation|personalization)/i, domain: 'Product' },
      { p: /(?:threat\s+detection|cybersecurity|SIEM)/i, domain: 'Security' },
      { p: /(?:talent|recruiting|HR\s+automation)/i, domain: 'Human Resources' },
    ];

    for (const { p, domain } of useCasePatterns) {
      const hits = lines.filter(l => p.test(l) && l.length > 20);
      if (hits.length > 0) {
        cases.push({
          name: domain + ' AI',
          domain,
          description: hits[0].replace(/^[-•*\d.)\]]\s*/, '').trim().slice(0, 200),
          maturity: hits.length > 2 ? 'scaling' : hits.length > 1 ? 'piloting' : 'exploring',
          impact: 'Identified in research',
        });
      }
    }

    return cases.slice(0, 12);
  }

  private extractBestPractices(content: string): string[] {
    const practices: string[] = [];
    const patterns = [
      /NIST\s+AI/i, /EU\s+AI\s+Act/i, /ISO\s*42001/i, /responsible\s+AI/i,
      /AI\s+ethics/i, /AI\s+safety/i, /model\s+governance/i, /bias\s+(?:testing|audit)/i,
      /explainab/i, /AI\s+risk\s+management/i, /data\s+privacy/i,
    ];

    for (const p of patterns) {
      if (p.test(content)) {
        const match = content.match(p);
        if (match) practices.push(match[0]);
      }
    }

    return [...new Set(practices)];
  }

  private extractSection(content: string, pattern: RegExp): string {
    const lines = content.split('\n');
    const idx = lines.findIndex(l => pattern.test(l));
    if (idx === -1) return '';
    return lines.slice(idx, idx + 8).join('\n').trim().slice(0, 800);
  }

  private fallbackFramework(): AGENTFramework {
    return {
      audit: { workflowName: 'Primary AI Workflow', trigger: 'To be determined', steps: [], finalOutput: 'To be determined' },
      gauge: { expectedOutcome: 'To be determined', assessments: [] },
      engineer: { redesignMap: [], challenges: [], processRefactoring: { blockers: [], removalStrategies: [], refactoredSteps: [] }, designSpecs: { agentRoles: '', orchestrationArchitecture: '', keyInputs: '', actions: '', outputs: '' } },
      navigate: { interactions: [], transparency: '', interventionPaths: '', governance: '', roleRedefinition: '', trainingNeeds: '' },
      track: { desiredOutcome: '', successSignals: [], metrics: [] },
      executiveSummary: 'AGENT Framework analysis requires Claude API for generation.',
    };
  }

  private emptyIntel(): AIGovernanceIntelligence {
    return {
      currentMaturity: '', governancePolicies: '', aiUseCases: [],
      adoptionApproach: '', operationalReadiness: '', bestPractices: [],
      agentFramework: this.fallbackFramework(), sources: [],
    };
  }
}

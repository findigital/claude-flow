/**
 * ARGUS Swarm Orchestrator
 *
 * Coordinates the agent swarm: initializes claude-flow coordination,
 * dispatches all agents in parallel, collects results, and triggers
 * report generation.
 */

import { execSync } from 'child_process';
import type {
  AuditConfig,
  AuditReport,
  OrgIntelligence,
  TechIntelligence,
  SecurityRiskIntelligence,
  CompetitiveIntelligence,
  RiskMatrixEntry,
  ThreatLevel,
} from './types.js';
import { PerplexityClient } from './perplexity-client.js';
import { ClaudeClient } from './claude-client.js';
import { ReconnaissanceAgent } from './agents/reconnaissance.js';
import { TechIntelligenceAgent } from './agents/tech-intelligence.js';
import { SecurityRiskAgent } from './agents/security-risk.js';
import { CompetitiveIntelAgent } from './agents/competitive-intel.js';
import { ReportGenerator } from './report/generator.js';

export class AuditOrchestrator {
  private config: AuditConfig;
  private perplexity: PerplexityClient;
  private claude: ClaudeClient;

  constructor(config: AuditConfig) {
    this.config = config;
    this.perplexity = new PerplexityClient(undefined, config.perplexityModel);
    this.claude = new ClaudeClient();
  }

  async execute(): Promise<AuditReport> {
    const startTime = Date.now();

    this.printBanner();
    this.initializeSwarm();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║        ARGUS AGENT SWARM — INTELLIGENCE COLLECTION          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const reconAgent = new ReconnaissanceAgent(this.perplexity, this.claude, this.config);
    const techAgent = new TechIntelligenceAgent(this.perplexity, this.claude, this.config);
    const secAgent = new SecurityRiskAgent(this.perplexity, this.claude, this.config);
    const compAgent = new CompetitiveIntelAgent(this.perplexity, this.claude, this.config);

    console.log('[SWARM] Dispatching 4 agents in parallel...\n');

    const [reconResult, techResult, secResult, compResult] = await Promise.all([
      reconAgent.execute(),
      techAgent.execute(),
      secAgent.execute(),
      compAgent.execute(),
    ]);

    console.log('\n[SWARM] All agents reported. Compiling intelligence...\n');

    const allSources = [
      ...reconResult.sources,
      ...techResult.sources,
      ...secResult.sources,
      ...compResult.sources,
    ];
    const uniqueSources = [...new Set(allSources)];

    const riskMatrix = this.buildRiskMatrix(
      secResult.data,
      compResult.data,
      techResult.data
    );

    let executiveSummary = '';
    let recommendations = '';

    if (this.claude.isAvailable) {
      console.log('[SYNTH] Generating executive summary via Claude...');
      executiveSummary = await this.claude.generateExecutiveSummary({
        'Organization Profile': reconResult.data.overview,
        'Technology & AI': techResult.data.engineeringCulture,
        'Security & Risk': secResult.data.overallPosture,
        'Competitive Position': compResult.data.marketPosition,
      });

      console.log('[SYNTH] Generating strategic recommendations via Claude...');
      recommendations = await this.claude.generateStrategicRecommendations(
        `${this.config.orgName} — ${reconResult.data.industry}`,
        [
          secResult.data.overallPosture,
          techResult.data.engineeringCulture,
          compResult.data.marketPosition,
        ].join('\n\n')
      );
    }

    if (!executiveSummary) {
      executiveSummary = this.generateFallbackSummary(
        reconResult.data, techResult.data, secResult.data, compResult.data
      );
    }

    const totalDuration = Date.now() - startTime;

    const report: AuditReport = {
      metadata: {
        reportId: `ARGUS-${Date.now().toString(36).toUpperCase()}`,
        classification: 'UNCLASSIFIED',
        generatedAt: new Date().toISOString(),
        generatedBy: 'ARGUS v1.0 — Agent-based Research & Governance Unified Scanner',
        targetOrg: this.config.orgName,
        targetUrl: this.config.targetUrl,
        auditDepth: this.config.depth,
        totalDurationMs: totalDuration,
        agentCount: 4,
        researchQueries: this.perplexity.totalQueries,
        version: '1.0.0',
      },
      executiveSummary,
      orgIntelligence: reconResult.data,
      techIntelligence: techResult.data,
      securityRisk: secResult.data,
      competitiveIntel: compResult.data,
      riskMatrix,
      strategicRecommendations: [],
      methodology: this.getMethodology(),
      allSources: uniqueSources,
    };

    console.log(`\n[SWARM] Audit complete in ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`[SWARM] ${this.perplexity.totalQueries} research queries executed`);
    console.log(`[SWARM] ${uniqueSources.length} unique sources collected`);

    const generator = new ReportGenerator();
    const outputPath = generator.generate(report, this.config.outputDir);
    console.log(`\n[OUTPUT] Report written to: ${outputPath}`);

    this.reportCompletion(totalDuration);

    return report;
  }

  private printBanner(): void {
    console.log(`
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║     █████╗ ██████╗  ██████╗ ██╗   ██╗███████╗            ║
    ║    ██╔══██╗██╔══██╗██╔════╝ ██║   ██║██╔════╝            ║
    ║    ███████║██████╔╝██║  ███╗██║   ██║███████╗            ║
    ║    ██╔══██║██╔══██╗██║   ██║██║   ██║╚════██║            ║
    ║    ██║  ██║██║  ██║╚██████╔╝╚██████╔╝███████║            ║
    ║    ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚══════╝            ║
    ║                                                           ║
    ║    Agent-based Research & Governance Unified Scanner       ║
    ║    Powered by Perplexity Sonar + Claude Intelligence       ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝

    Target:  ${this.config.orgName}
    URL:     ${this.config.targetUrl}
    Depth:   ${this.config.depth}
    Claude:  ${this.claude.isAvailable ? 'ENABLED' : 'DISABLED (Perplexity-only mode)'}
    `);
  }

  private initializeSwarm(): void {
    try {
      const cliPath = `${process.cwd()}/v3/@claude-flow/cli/bin/cli.js`;
      execSync(
        `node ${cliPath} swarm init --topology hierarchical --max-agents 5 2>/dev/null`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      console.log('[SWARM] Claude Flow coordination initialized');
    } catch {
      console.log('[SWARM] Running in standalone mode (claude-flow coordination optional)');
    }
  }

  private reportCompletion(durationMs: number): void {
    try {
      const cliPath = `${process.cwd()}/v3/@claude-flow/cli/bin/cli.js`;
      execSync(
        `node ${cliPath} memory store --key "argus-audit-${this.config.orgName}" ` +
        `--value "Audit completed in ${(durationMs / 1000).toFixed(1)}s for ${this.config.orgName}" ` +
        `--namespace patterns 2>/dev/null`,
        { encoding: 'utf-8', timeout: 10000 }
      );
    } catch {
      // non-critical
    }
  }

  private buildRiskMatrix(
    sec: SecurityRiskIntelligence,
    comp: CompetitiveIntelligence,
    tech: TechIntelligence
  ): RiskMatrixEntry[] {
    const matrix: RiskMatrixEntry[] = [];

    if (sec.knownBreaches.length > 0) {
      matrix.push({
        category: 'Cybersecurity',
        riskName: 'Historical Data Breaches',
        likelihood: 7,
        impact: 9,
        riskScore: 63,
        threatLevel: 'HIGH',
        description: `${sec.knownBreaches.length} historical breach(es) identified`,
        mitigations: ['Enhanced monitoring', 'Incident response review', 'Third-party audit'],
      });
    }

    if (sec.regulatoryRisks.length > 0) {
      matrix.push({
        category: 'Regulatory',
        riskName: 'Regulatory Exposure',
        likelihood: 6,
        impact: 8,
        riskScore: 48,
        threatLevel: 'HIGH',
        description: `${sec.regulatoryRisks.length} regulatory risk indicator(s)`,
        mitigations: ['Compliance program review', 'Legal counsel engagement'],
      });
    }

    if (comp.weaknesses.length > 0) {
      matrix.push({
        category: 'Competitive',
        riskName: 'Competitive Vulnerabilities',
        likelihood: 5,
        impact: 6,
        riskScore: 30,
        threatLevel: 'MEDIUM',
        description: `${comp.weaknesses.length} competitive weakness(es) identified`,
        mitigations: ['Strategic positioning review', 'Differentiation investment'],
      });
    }

    if (tech.aiCapabilities.length === 0) {
      matrix.push({
        category: 'Technology',
        riskName: 'AI Capability Gap',
        likelihood: 7,
        impact: 7,
        riskScore: 49,
        threatLevel: 'MEDIUM',
        description: 'Limited or no AI capabilities detected',
        mitigations: ['AI strategy development', 'Talent acquisition', 'Partnership evaluation'],
      });
    }

    matrix.push({
      category: 'Operational',
      riskName: 'Supply Chain Dependencies',
      likelihood: 4,
      impact: 7,
      riskScore: 28,
      threatLevel: sec.supplyChainRisks.length > 2 ? 'HIGH' : 'MEDIUM',
      description: `${sec.supplyChainRisks.length} supply chain risk(s) identified`,
      mitigations: ['Vendor diversification', 'Business continuity planning'],
    });

    return matrix.sort((a, b) => b.riskScore - a.riskScore);
  }

  private generateFallbackSummary(
    recon: OrgIntelligence,
    tech: TechIntelligence,
    sec: SecurityRiskIntelligence,
    comp: CompetitiveIntelligence
  ): string {
    return [
      `## Executive Summary — ${recon.name}`,
      '',
      `**BLUF**: ${recon.name} is a ${recon.industry} organization ` +
      `${recon.headquarters ? `headquartered in ${recon.headquarters}` : ''}. ` +
      `The security risk score is ${sec.riskScore}/100 (${sec.riskScore <= 40 ? 'acceptable' : 'elevated'}). ` +
      `${tech.aiCapabilities.length} AI capabilities were identified across the organization.`,
      '',
      '**Key Findings:**',
      `- Technology: ${tech.techStack.length} technology categories mapped, ${tech.aiCapabilities.length} AI capabilities detected`,
      `- Security: Risk score ${sec.riskScore}/100, ${sec.knownBreaches.length} historical breach(es), ` +
      `${sec.complianceCertifications.length} compliance certification(s)`,
      `- Competitive: ${comp.competitors.length} competitors identified, ` +
      `${comp.partnerships.length} partnerships mapped`,
      `- Sources: ${recon.sources.length + tech.sources.length + sec.sources.length + comp.sources.length} sources consulted`,
    ].join('\n');
  }

  private getMethodology(): string {
    return [
      '## Methodology',
      '',
      'This assessment was conducted using the ARGUS (Agent-based Research & Governance',
      'Unified Scanner) framework, which employs a coordinated swarm of specialized',
      'intelligence agents:',
      '',
      '1. **Reconnaissance Agent** — Organization profiling via deep web research',
      '2. **Technology Intelligence Agent** — Tech stack and AI capability mapping',
      '3. **Security & Risk Agent** — OSINT-based security posture assessment',
      '4. **Competitive Intelligence Agent** — Market and competitive landscape analysis',
      '',
      'Research was conducted using the Perplexity Sonar deep research engine for',
      'comprehensive web intelligence gathering. Where available, Anthropic Claude',
      'was used for analytical synthesis and intelligence report writing.',
      '',
      'All findings are derived from publicly available information (OSINT).',
      'Confidence levels are assigned to key assessments. This report should be',
      'treated as a preliminary intelligence product and validated with primary',
      'sources before strategic decision-making.',
    ].join('\n');
  }
}

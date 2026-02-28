/**
 * ARGUS Swarm Orchestrator
 *
 * Coordinates the agent swarm with cost-optimized model routing:
 *
 *   Agent              | Model(s) Used                          | Why
 *   ──────────────────-|────────────────────────────────────────|──────────────
 *   Reconnaissance     | sonar + sonar-reasoning-pro            | Facts cheap, analysis mid
 *   Tech Intelligence  | sonar-deep-research (low/medium)       | Justifies premium for exhaustive AI/tech mapping
 *   Security & Risk    | sonar + sonar-reasoning-pro            | Facts cheap, risk analysis mid
 *   Competitive Intel  | sonar + sonar-reasoning-pro            | Facts cheap, strategy mid
 *
 * Only 1 deep-research query per audit. All others use sonar ($1/$1) or
 * sonar-reasoning-pro ($2/$8) to keep costs practical.
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
    this.perplexity = new PerplexityClient();
    this.claude = new ClaudeClient();
  }

  async execute(): Promise<AuditReport> {
    const startTime = Date.now();

    this.printBanner();
    this.initializeSwarm();

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║        ARGUS AGENT SWARM — INTELLIGENCE COLLECTION          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    this.printModelStrategy();

    const reconAgent = new ReconnaissanceAgent(this.perplexity, this.claude, this.config);
    const techAgent = new TechIntelligenceAgent(this.perplexity, this.claude, this.config);
    const secAgent = new SecurityRiskAgent(this.perplexity, this.claude, this.config);
    const compAgent = new CompetitiveIntelAgent(this.perplexity, this.claude, this.config);

    console.log('[SWARM] Dispatching 4 agents sequentially...\n');

    const reconResult = await reconAgent.execute();
    console.log('');
    const techResult = await techAgent.execute();
    console.log('');
    const secResult = await secAgent.execute();
    console.log('');
    const compResult = await compAgent.execute();

    console.log('\n[SWARM] All agents reported. Compiling intelligence...\n');

    const allSources = [
      ...reconResult.sources, ...techResult.sources,
      ...secResult.sources, ...compResult.sources,
    ];
    const uniqueSources = [...new Set(allSources)];

    const riskMatrix = this.buildRiskMatrix(secResult.data, compResult.data, techResult.data);

    let executiveSummary = '';

    if (this.claude.isAvailable) {
      console.log('[SYNTH] Generating executive summary via Claude...');
      executiveSummary = await this.claude.generateExecutiveSummary({
        'Organization Profile': reconResult.data.overview,
        'Technology & AI': techResult.data.engineeringCulture,
        'Security & Risk': secResult.data.overallPosture,
        'Competitive Position': compResult.data.marketPosition,
      });

      console.log('[SYNTH] Generating strategic recommendations via Claude...');
      await this.claude.generateStrategicRecommendations(
        `${this.config.orgName} — ${reconResult.data.industry}`,
        [secResult.data.overallPosture, techResult.data.engineeringCulture, compResult.data.marketPosition].join('\n\n')
      );
    }

    if (!executiveSummary) {
      executiveSummary = this.generateFallbackSummary(reconResult.data, techResult.data, secResult.data, compResult.data);
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

    const generator = new ReportGenerator();
    const outputPath = generator.generate(report, this.config.outputDir);

    this.printCostSummary(totalDuration, uniqueSources.length, outputPath);
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

  private printModelStrategy(): void {
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  MODEL ROUTING STRATEGY (cost-optimized)                        │');
    console.log('├──────────────────────┬──────────────────────────┬───────────────┤');
    console.log('│  Agent               │  Model                   │  Cost Tier    │');
    console.log('├──────────────────────┼──────────────────────────┼───────────────┤');
    console.log('│  Reconnaissance      │  sonar + reasoning-pro   │  $  LOW+MID   │');
    console.log('│  Tech Intelligence   │  sonar-deep-research     │  $$$ PREMIUM  │');
    console.log('│  Security & Risk     │  sonar + reasoning-pro   │  $  LOW+MID   │');
    console.log('│  Competitive Intel   │  sonar + reasoning-pro   │  $  LOW+MID   │');
    console.log('└──────────────────────┴──────────────────────────┴───────────────┘');
    console.log('');
  }

  private printCostSummary(totalDuration: number, sourceCount: number, outputPath: string): void {
    const usage = this.perplexity.modelUsageSummary;
    const totalCost = this.perplexity.totalCostUsd;

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    AUDIT COMPLETE                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Duration:       ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`  Queries:        ${this.perplexity.totalQueries}`);
    console.log(`  Sources:        ${sourceCount} unique`);
    console.log(`  Est. API Cost:  $${totalCost.toFixed(4)}`);
    console.log('');
    console.log('  Model Breakdown:');

    for (const [model, stats] of Object.entries(usage)) {
      console.log(`    ${model.padEnd(24)} ${stats.queries} queries   ~$${stats.estimatedCost.toFixed(4)}`);
    }

    console.log('');
    console.log(`  Report: ${outputPath}`);
  }

  private initializeSwarm(): void {
    try {
      const cliPath = `${process.cwd()}/v3/@claude-flow/cli/bin/cli.js`;
      execSync(`node ${cliPath} swarm init --topology hierarchical --max-agents 5 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
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
        `--value "Audit: ${(durationMs / 1000).toFixed(1)}s, ${this.perplexity.totalQueries} queries, ~$${this.perplexity.totalCostUsd.toFixed(4)}" ` +
        `--namespace patterns 2>/dev/null`,
        { encoding: 'utf-8', timeout: 10000 }
      );
    } catch { /* non-critical */ }
  }

  private buildRiskMatrix(sec: SecurityRiskIntelligence, comp: CompetitiveIntelligence, tech: TechIntelligence): RiskMatrixEntry[] {
    const matrix: RiskMatrixEntry[] = [];

    if (sec.knownBreaches.length > 0) {
      matrix.push({ category: 'Cybersecurity', riskName: 'Historical Data Breaches', likelihood: 7, impact: 9, riskScore: 63, threatLevel: 'HIGH', description: `${sec.knownBreaches.length} breach(es)`, mitigations: ['Enhanced monitoring', 'Incident response review'] });
    }
    if (sec.regulatoryRisks.length > 0) {
      matrix.push({ category: 'Regulatory', riskName: 'Regulatory Exposure', likelihood: 6, impact: 8, riskScore: 48, threatLevel: 'HIGH', description: `${sec.regulatoryRisks.length} indicator(s)`, mitigations: ['Compliance review', 'Legal counsel'] });
    }
    if (comp.weaknesses.length > 0) {
      matrix.push({ category: 'Competitive', riskName: 'Competitive Vulnerabilities', likelihood: 5, impact: 6, riskScore: 30, threatLevel: 'MEDIUM', description: `${comp.weaknesses.length} weakness(es)`, mitigations: ['Strategic positioning', 'Differentiation'] });
    }
    if (tech.aiCapabilities.length === 0) {
      matrix.push({ category: 'Technology', riskName: 'AI Capability Gap', likelihood: 7, impact: 7, riskScore: 49, threatLevel: 'MEDIUM', description: 'No AI capabilities detected', mitigations: ['AI strategy', 'Talent acquisition'] });
    }
    matrix.push({ category: 'Operational', riskName: 'Supply Chain Dependencies', likelihood: 4, impact: 7, riskScore: 28, threatLevel: sec.supplyChainRisks.length > 2 ? 'HIGH' : 'MEDIUM', description: `${sec.supplyChainRisks.length} risk(s)`, mitigations: ['Vendor diversification', 'BCP'] });

    return matrix.sort((a, b) => b.riskScore - a.riskScore);
  }

  private generateFallbackSummary(recon: OrgIntelligence, tech: TechIntelligence, sec: SecurityRiskIntelligence, comp: CompetitiveIntelligence): string {
    return [
      `## Executive Summary — ${recon.name}`,
      '',
      `**BLUF**: ${recon.name} is a ${recon.industry} organization` +
      `${recon.headquarters ? ` headquartered in ${recon.headquarters}` : ''}. ` +
      `Security risk score: ${sec.riskScore}/100 (${sec.riskScore <= 40 ? 'acceptable' : 'elevated'}). ` +
      `${tech.aiCapabilities.length} AI capabilities identified.`,
      '',
      '**Key Findings:**',
      `- Tech: ${tech.techStack.length} categories, ${tech.aiCapabilities.length} AI capabilities`,
      `- Security: ${sec.riskScore}/100 risk, ${sec.knownBreaches.length} breach(es), ${sec.complianceCertifications.length} cert(s)`,
      `- Competitive: ${comp.competitors.length} competitors, ${comp.partnerships.length} partnerships`,
    ].join('\n');
  }

  private getMethodology(): string {
    return [
      '## Methodology',
      '',
      'This assessment was conducted using ARGUS with cost-optimized multi-model routing:',
      '',
      '| Agent | Model | Rationale |',
      '|-------|-------|-----------|',
      '| Reconnaissance | sonar + sonar-reasoning-pro | Factual lookup (cheap) + news analysis (mid-tier) |',
      '| Tech Intelligence | sonar-deep-research | Exhaustive AI/tech mapping justifies premium model |',
      '| Security & Risk | sonar + sonar-reasoning-pro | Breach facts (cheap) + risk reasoning (mid-tier) |',
      '| Competitive Intel | sonar + sonar-reasoning-pro | Market facts (cheap) + strategic analysis (mid-tier) |',
      '',
      'Perplexity Sonar models provide real-time web search with citations.',
      'Anthropic Claude provides analytical synthesis and report writing.',
      'All findings are derived from publicly available information (OSINT).',
    ].join('\n');
  }
}

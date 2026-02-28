/**
 * ARGUS Competitive Intelligence Agent
 *
 * Maps the organization's market position, competitive landscape,
 * partnerships, acquisitions, and growth trajectory.
 *
 * Model routing:
 *   sonar               — factual market data (cheap, fast)
 *   sonar-reasoning-pro — strategic competitive analysis (multi-step CoT)
 */

import type { AgentResult, CompetitiveIntelligence, AuditConfig } from '../types.js';
import { PerplexityClient } from '../perplexity-client.js';
import { ClaudeClient } from '../claude-client.js';

export class CompetitiveIntelAgent {
  private pplx: PerplexityClient;
  private claude: ClaudeClient;
  private config: AuditConfig;

  constructor(pplx: PerplexityClient, claude: ClaudeClient, config: AuditConfig) {
    this.pplx = pplx;
    this.claude = claude;
    this.config = config;
  }

  async execute(): Promise<AgentResult<CompetitiveIntelligence>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const allSources: string[] = [];

    console.log(`[COMP] Mapping competitive landscape for ${this.config.orgName}...`);

    let intel: CompetitiveIntelligence = this.emptyIntel();

    try {
      // Phase 1: Factual market data via sonar (cheap — $1/$1 per 1M)
      console.log('[COMP] Phase 1 — Market facts via sonar...');
      const marketFacts = await this.pplx.quickSearch(
        `${this.config.orgName} (${this.config.targetUrl}) competitive landscape: ` +
        `Who are the main competitors? What is the estimated market share? ` +
        `What companies has ${this.config.orgName} acquired? ` +
        `What strategic partnerships and alliances exist? ` +
        `What is the funding history, valuation, and investor information?`
      );
      allSources.push(...marketFacts.citations);

      // Phase 2: Strategic analysis via sonar-reasoning-pro ($2/$8 per 1M)
      console.log('[COMP] Phase 2 — Strategic analysis via sonar-reasoning-pro...');
      const stratAnalysis = await this.pplx.analyze(
        `Conduct a strategic competitive analysis of ${this.config.orgName} (${this.config.targetUrl}). ` +
        `Analyze: (1) Key competitive differentiators and moats — what makes them hard to displace? ` +
        `(2) Competitive vulnerabilities and weaknesses that rivals could exploit. ` +
        `(3) Growth trajectory assessment — is the company accelerating, stable, or decelerating? ` +
        `(4) How do they compare to their top 3 competitors on key dimensions? ` +
        `Rate each competitor as LOW / MEDIUM / HIGH threat level.`
      );
      allSources.push(...stratAnalysis.citations);

      intel = this.parseIntelligence(marketFacts.content, stratAnalysis.content, allSources);

      if (this.claude.isAvailable && this.config.depth === 'deep') {
        console.log('[COMP] Phase 3 — Claude strategic synthesis...');
        const synthesis = await this.claude.synthesizeIntelligence(
          `Market Facts:\n${marketFacts.content}\n\nStrategic Analysis:\n${stratAnalysis.content}`,
          'Competitive Intelligence Assessment'
        );
        if (synthesis) intel.marketPosition = synthesis;
      }
    } catch (e) {
      errors.push(`Competitive intel error: ${e}`);
      console.error(`[COMP] Error: ${e}`);
    }

    console.log(`[COMP] Complete — ${intel.competitors.length} competitors mapped`);

    return {
      agentId: 'comp-001',
      agentType: 'competitive-intel',
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      status: errors.length > 0 ? 'partial' : 'success',
      data: intel,
      sources: [...new Set(allSources)],
      errors,
    };
  }

  private parseIntelligence(
    factsContent: string,
    analysisContent: string,
    sources: string[]
  ): CompetitiveIntelligence {
    return {
      marketPosition: analysisContent.slice(0, 2000),
      marketShare: this.extractMarketShare(factsContent),
      competitors: this.extractCompetitors(analysisContent),
      differentiators: this.extractByPattern(analysisContent, /differentiator|advantage|strength|unique|moat/i),
      weaknesses: this.extractByPattern(analysisContent, /weakness|vulnerabilit|challenge|disadvantage|risk/i),
      partnerships: this.extractPartnerships(factsContent),
      acquisitions: this.extractByPattern(factsContent, /acqui(?:red|sition)|bought|merged/i),
      fundingHistory: this.extractSection(factsContent, /funding|raised|valuation|Series\s+[A-Z]|IPO/i),
      growthTrajectory: this.extractSection(analysisContent, /growth|trajectory|revenue\s+growth|expand|accelerat/i),
      sources: [...new Set(sources)],
    };
  }

  private extractCompetitors(content: string): CompetitiveIntelligence['competitors'] {
    const competitors: CompetitiveIntelligence['competitors'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (!/compet|rival|versus|vs\.?|alternative|threat/i.test(line) || line.length < 20) continue;
      const nameMatch = line.match(/\*\*([^*]+)\*\*|([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/);
      if (!nameMatch) continue;
      const name = (nameMatch[1] ?? nameMatch[2] ?? '').trim();
      if (name.length < 2 || name.length > 50) continue;

      const threatLevel = /high\s+threat|major\s+competitor|primary\s+rival/i.test(line) ? 'HIGH' as const
        : /low\s+threat|minor|niche/i.test(line) ? 'LOW' as const : 'MEDIUM' as const;

      competitors.push({
        name,
        comparison: line.replace(/^[-•*\d.)\]]\s*/, '').trim().slice(0, 200),
        threatLevel,
      });
    }

    return competitors.slice(0, 10);
  }

  private extractPartnerships(content: string): CompetitiveIntelligence['partnerships'] {
    return content.split('\n')
      .filter(l => /partner|alliance|collaboration|integrat/i.test(l) && l.length > 20)
      .slice(0, 10)
      .map(l => ({
        partner: l.match(/\*\*([^*]+)\*\*/)?.[1] ?? 'See details',
        nature: l.replace(/^[-•*\d.)\]]\s*/, '').trim().slice(0, 200),
        significance: 'Identified in research',
      }));
  }

  private extractMarketShare(content: string): string {
    return content.match(/market\s+share[^.]*?(\d+[%.]?\d*\s*%?[^.\n]*)/i)?.[0]?.trim()?.slice(0, 200) ?? 'Not publicly available';
  }

  private extractByPattern(content: string, pattern: RegExp): string[] {
    return content.split('\n')
      .filter(l => pattern.test(l) && l.length > 15)
      .slice(0, 8)
      .map(l => l.replace(/^[-•*\d.)\]]\s*/, '').trim());
  }

  private extractSection(content: string, pattern: RegExp): string {
    const lines = content.split('\n');
    const idx = lines.findIndex(l => pattern.test(l));
    if (idx === -1) return '';
    return lines.slice(idx, idx + 6).join('\n').trim().slice(0, 600);
  }

  private emptyIntel(): CompetitiveIntelligence {
    return {
      marketPosition: '', marketShare: '', competitors: [], differentiators: [],
      weaknesses: [], partnerships: [], acquisitions: [], fundingHistory: '',
      growthTrajectory: '', sources: [],
    };
  }
}

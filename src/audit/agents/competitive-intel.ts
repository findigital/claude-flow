/**
 * ARGUS Competitive Intelligence Agent
 *
 * Maps the organization's market position, competitive landscape,
 * partnerships, acquisitions, and growth trajectory through
 * open-source intelligence gathering.
 */

import type { AgentResult, CompetitiveIntelligence, AuditConfig } from '../types.js';
import { PerplexityClient } from '../perplexity-client.js';
import { ClaudeClient } from '../claude-client.js';

export class CompetitiveIntelAgent {
  private perplexity: PerplexityClient;
  private claude: ClaudeClient;
  private config: AuditConfig;

  constructor(perplexity: PerplexityClient, claude: ClaudeClient, config: AuditConfig) {
    this.perplexity = perplexity;
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
      console.log('[COMP] Phase 1 — Market position and competitors...');
      const marketResearch = await this.perplexity.deepResearch(
        `${this.config.orgName} market position, competitors, and competitive landscape`,
        [
          `Who are ${this.config.orgName}'s main competitors? How does each compare in terms of market share, capabilities, and positioning?`,
          `What is ${this.config.orgName}'s estimated market share in its primary markets?`,
          `What are ${this.config.orgName}'s key competitive differentiators and unique advantages?`,
          `What are ${this.config.orgName}'s known weaknesses or competitive vulnerabilities?`,
        ]
      );
      allSources.push(...marketResearch.citations);

      console.log('[COMP] Phase 2 — Partnerships, M&A, and growth...');
      const growthResearch = await this.perplexity.deepResearch(
        `${this.config.orgName} partnerships, acquisitions, funding, and growth`,
        [
          `What strategic partnerships and alliances has ${this.config.orgName} formed? Include technology partners, resellers, and ecosystem partnerships`,
          `What companies has ${this.config.orgName} acquired? Include dates and strategic rationale`,
          `What is ${this.config.orgName}'s funding history? Include rounds, amounts, investors, and valuation if available`,
          `What is ${this.config.orgName}'s growth trajectory? Revenue growth, customer growth, market expansion`,
        ]
      );
      allSources.push(...growthResearch.citations);

      intel = this.parseIntelligence(marketResearch.content, growthResearch.content, allSources);

      if (this.claude.isAvailable && this.config.depth === 'deep') {
        console.log('[COMP] Phase 3 — Claude strategic analysis...');
        const synthesis = await this.claude.synthesizeIntelligence(
          `Market Research:\n${marketResearch.content}\n\nGrowth Research:\n${growthResearch.content}`,
          'Competitive Intelligence Assessment'
        );
        if (synthesis) {
          intel.marketPosition = synthesis;
        }
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
    marketContent: string,
    growthContent: string,
    sources: string[]
  ): CompetitiveIntelligence {
    return {
      marketPosition: marketContent.slice(0, 2000),
      marketShare: this.extractMarketShare(marketContent),
      competitors: this.extractCompetitors(marketContent),
      differentiators: this.extractListItems(marketContent, /differentiator|advantage|strength|unique/i),
      weaknesses: this.extractListItems(marketContent, /weakness|vulnerabilit|challenge|disadvantage/i),
      partnerships: this.extractPartnerships(growthContent),
      acquisitions: this.extractListItems(growthContent, /acqui(?:red|sition)|bought|merged/i),
      fundingHistory: this.extractSection(growthContent, /funding|raised|valuation|Series\s+[A-Z]/i),
      growthTrajectory: this.extractSection(growthContent, /growth|revenue\s+growth|expand/i),
      sources: [...new Set(sources)],
    };
  }

  private extractCompetitors(content: string): CompetitiveIntelligence['competitors'] {
    const competitors: CompetitiveIntelligence['competitors'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (/compet(?:itor|es|ing)|rival|versus|vs\.?|alternative/i.test(line) && line.length > 20) {
        const nameMatch = line.match(/\*\*([^*]+)\*\*|([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/);
        if (nameMatch) {
          const name = (nameMatch[1] ?? nameMatch[2] ?? '').trim();
          if (name.length > 1 && name.length < 50) {
            competitors.push({
              name,
              comparison: line.replace(/^[-•*]\s*/, '').trim().slice(0, 200),
              threatLevel: 'MEDIUM',
            });
          }
        }
      }
    }

    return competitors.slice(0, 10);
  }

  private extractPartnerships(content: string): CompetitiveIntelligence['partnerships'] {
    const partnerships: CompetitiveIntelligence['partnerships'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (/partner|alliance|collaboration|integrat/i.test(line) && line.length > 20) {
        partnerships.push({
          partner: line.match(/\*\*([^*]+)\*\*/)?.[1] ?? 'See details',
          nature: line.replace(/^[-•*]\s*/, '').trim().slice(0, 200),
          significance: 'Identified in research',
        });
      }
    }

    return partnerships.slice(0, 10);
  }

  private extractMarketShare(content: string): string {
    const match = content.match(/market\s+share[^.]*?(\d+[%.]?\d*\s*%?[^.\n]*)/i);
    return match?.[0]?.trim()?.slice(0, 200) ?? 'Not publicly available';
  }

  private extractListItems(content: string, pattern: RegExp): string[] {
    return content
      .split('\n')
      .filter(l => pattern.test(l) && l.length > 15)
      .slice(0, 8)
      .map(l => l.replace(/^[-•*]\s*/, '').trim());
  }

  private extractSection(content: string, pattern: RegExp): string {
    const lines = content.split('\n');
    const idx = lines.findIndex(l => pattern.test(l));
    if (idx === -1) return '';
    return lines.slice(idx, idx + 6).join('\n').trim().slice(0, 600);
  }

  private emptyIntel(): CompetitiveIntelligence {
    return {
      marketPosition: '',
      marketShare: '',
      competitors: [],
      differentiators: [],
      weaknesses: [],
      partnerships: [],
      acquisitions: [],
      fundingHistory: '',
      growthTrajectory: '',
      sources: [],
    };
  }
}

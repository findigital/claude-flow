/**
 * ARGUS Reconnaissance Agent
 *
 * Primary intelligence collection. Builds the organizational profile
 * via deep web research: leadership, products, financials, recent events.
 */

import type { AgentResult, OrgIntelligence, AuditConfig } from '../types.js';
import { PerplexityClient } from '../perplexity-client.js';
import { ClaudeClient } from '../claude-client.js';

export class ReconnaissanceAgent {
  private perplexity: PerplexityClient;
  private claude: ClaudeClient;
  private config: AuditConfig;

  constructor(perplexity: PerplexityClient, claude: ClaudeClient, config: AuditConfig) {
    this.perplexity = perplexity;
    this.claude = claude;
    this.config = config;
  }

  async execute(): Promise<AgentResult<OrgIntelligence>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const allSources: string[] = [];

    console.log(`[RECON] Initiating reconnaissance on ${this.config.orgName} (${this.config.targetUrl})...`);

    let orgProfile: OrgIntelligence = this.emptyProfile();

    try {
      console.log('[RECON] Phase 1 — Core organizational intelligence...');
      const coreResearch = await this.perplexity.deepResearch(
        `${this.config.orgName} — company at ${this.config.targetUrl}`,
        [
          `What is ${this.config.orgName}? Comprehensive overview including founding date, headquarters location, and mission statement`,
          `CEO and key leadership team of ${this.config.orgName}`,
          `Number of employees and company size`,
          `Revenue figures and financial status (public/private, stock ticker if applicable)`,
          `Core products and services offered by ${this.config.orgName}`,
          `Industry sector and primary market`,
        ]
      );
      allSources.push(...coreResearch.citations);

      console.log('[RECON] Phase 2 — Recent developments and news...');
      const newsResearch = await this.perplexity.research(
        `What are the most significant recent news, announcements, partnerships, ` +
        `and developments for ${this.config.orgName} (${this.config.targetUrl}) ` +
        `in the past 12 months? Include specific dates and details.`
      );
      allSources.push(...newsResearch.citations);

      orgProfile = await this.parseProfile(
        coreResearch.content,
        newsResearch.content,
        allSources
      );

      if (this.claude.isAvailable) {
        console.log('[RECON] Phase 3 — Claude intelligence synthesis...');
        const synthesis = await this.claude.synthesizeIntelligence(
          `Core Research:\n${coreResearch.content}\n\nRecent News:\n${newsResearch.content}`,
          'Organizational Reconnaissance'
        );
        if (synthesis) {
          orgProfile.overview = synthesis;
        }
      }
    } catch (e) {
      errors.push(`Reconnaissance error: ${e}`);
      console.error(`[RECON] Error: ${e}`);
    }

    console.log(`[RECON] Complete — ${allSources.length} sources collected`);

    return {
      agentId: 'recon-001',
      agentType: 'reconnaissance',
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      status: errors.length > 0 ? 'partial' : 'success',
      data: orgProfile,
      sources: [...new Set(allSources)],
      errors,
    };
  }

  private async parseProfile(
    coreContent: string,
    newsContent: string,
    sources: string[]
  ): Promise<OrgIntelligence> {
    const extract = (pattern: RegExp, text: string): string => {
      const match = text.match(pattern);
      return match?.[1]?.trim() ?? '';
    };

    const news = newsContent
      .split(/\n/)
      .filter(line => line.trim().length > 20)
      .slice(0, 10)
      .map(line => line.replace(/^[-•*]\s*/, '').trim());

    const products = coreContent
      .split(/\n/)
      .filter(line => /product|platform|service|solution|offering/i.test(line))
      .slice(0, 8)
      .map(line => line.replace(/^[-•*]\s*/, '').trim());

    return {
      name: this.config.orgName,
      website: this.config.targetUrl,
      overview: coreContent.slice(0, 3000),
      founded: extract(/(?:founded|established|started)\s+(?:in\s+)?(\d{4})/i, coreContent),
      headquarters: extract(/(?:headquartered|based|located)\s+(?:in\s+)?([^.,:]+)/i, coreContent),
      ceo: extract(/(?:CEO|chief executive)\s+(?:officer\s+)?(?:is\s+)?([A-Z][a-z]+ [A-Z][a-z]+)/i, coreContent),
      employees: extract(/(\d[\d,]+)\s+(?:employees|workers|staff)/i, coreContent),
      revenue: extract(/(?:revenue|sales)\s+(?:of\s+)?(\$[\d.]+\s*(?:billion|million|B|M))/i, coreContent),
      industry: extract(/(?:industry|sector|market):\s*([^.\n]+)/i, coreContent) || 'Technology',
      publicOrPrivate: /(?:publicly traded|NYSE|NASDAQ|stock ticker)/i.test(coreContent)
        ? 'Public' : /private(?:ly held)?/i.test(coreContent) ? 'Private' : 'Unknown',
      stockTicker: extract(/(?:ticker|symbol|NYSE|NASDAQ)[:\s]+([A-Z]{1,5})/i, coreContent),
      mission: extract(/(?:mission|vision)\s+(?:is\s+)?(?:to\s+)?[""]?([^"".\n]+)/i, coreContent),
      keyProducts: products.length > 0 ? products : ['See overview for details'],
      recentNews: news.length > 0 ? news : ['No recent news extracted'],
      sources: [...new Set(sources)],
    };
  }

  private emptyProfile(): OrgIntelligence {
    return {
      name: this.config.orgName,
      website: this.config.targetUrl,
      overview: '',
      founded: '',
      headquarters: '',
      ceo: '',
      employees: '',
      revenue: '',
      industry: '',
      publicOrPrivate: '',
      stockTicker: '',
      mission: '',
      keyProducts: [],
      recentNews: [],
      sources: [],
    };
  }
}

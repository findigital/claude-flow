/**
 * ARGUS Reconnaissance Agent
 *
 * Primary intelligence collection. Builds the organizational profile
 * via deep web research: leadership, products, financials, recent events.
 *
 * Model routing:
 *   sonar           — fast factual org basics (cheap)
 *   sonar-reasoning-pro — recent news synthesis (medium)
 */

import type { AgentResult, OrgIntelligence, AuditConfig } from '../types.js';
import { PerplexityClient } from '../perplexity-client.js';
import { ClaudeClient } from '../claude-client.js';

export class ReconnaissanceAgent {
  private pplx: PerplexityClient;
  private claude: ClaudeClient;
  private config: AuditConfig;

  constructor(pplx: PerplexityClient, claude: ClaudeClient, config: AuditConfig) {
    this.pplx = pplx;
    this.claude = claude;
    this.config = config;
  }

  async execute(): Promise<AgentResult<OrgIntelligence>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const allSources: string[] = [];

    console.log(`[RECON] Initiating reconnaissance on ${this.config.orgName}...`);

    let profile: OrgIntelligence = this.emptyProfile();

    try {
      // Phase 1: Quick factual lookup via sonar (cheapest — $1/$1 per 1M)
      console.log('[RECON] Phase 1 — Org basics via sonar...');
      const basics = await this.pplx.quickSearch(
        `Give me a comprehensive factual profile of ${this.config.orgName} (${this.config.targetUrl}). ` +
        `Include: founding year, headquarters, CEO name, number of employees, ` +
        `annual revenue, public/private status, stock ticker, industry, ` +
        `mission statement, and their main products and services.`
      );
      allSources.push(...basics.citations);

      // Phase 2: Recent news via sonar-reasoning-pro (multi-step analysis — $2/$8 per 1M)
      console.log('[RECON] Phase 2 — Recent developments via sonar-reasoning-pro...');
      const news = await this.pplx.analyze(
        `Analyze the most significant recent news, announcements, partnerships, ` +
        `and developments for ${this.config.orgName} (${this.config.targetUrl}) ` +
        `in the past 12 months. For each development, assess its strategic significance ` +
        `and potential impact on the organization's trajectory. Provide specific dates.`
      );
      allSources.push(...news.citations);

      profile = this.parseProfile(basics.content, news.content, allSources);

      // Phase 3 (optional): Claude synthesis for polished intelligence
      if (this.claude.isAvailable) {
        console.log('[RECON] Phase 3 — Claude intelligence synthesis...');
        const synthesis = await this.claude.synthesizeIntelligence(
          `Organization Profile:\n${basics.content}\n\nRecent Developments:\n${news.content}`,
          'Organizational Reconnaissance'
        );
        if (synthesis) profile.overview = synthesis;
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
      data: profile,
      sources: [...new Set(allSources)],
      errors,
    };
  }

  private parseProfile(
    basicsContent: string,
    newsContent: string,
    sources: string[]
  ): OrgIntelligence {
    const ext = (pattern: RegExp, text: string): string => {
      const m = text.match(pattern);
      return m?.[1]?.trim() ?? '';
    };

    const news = newsContent
      .split(/\n/)
      .filter(l => l.trim().length > 20)
      .slice(0, 10)
      .map(l => l.replace(/^[-•*\d.)\]]\s*/, '').trim());

    const products = basicsContent
      .split(/\n/)
      .filter(l => /product|platform|service|solution|offering/i.test(l))
      .slice(0, 8)
      .map(l => l.replace(/^[-•*\d.)\]]\s*/, '').trim());

    return {
      name: this.config.orgName,
      website: this.config.targetUrl,
      overview: basicsContent.slice(0, 3000),
      founded: ext(/(?:founded|established|started)\s+(?:in\s+)?(\d{4})/i, basicsContent),
      headquarters: ext(/(?:headquartered|based|located)\s+(?:in\s+)?([^.,:]+)/i, basicsContent),
      ceo: ext(/(?:CEO|chief executive)\s+(?:officer\s+)?(?:is\s+)?([A-Z][a-z]+ [A-Z][a-z]+)/i, basicsContent),
      employees: ext(/(\d[\d,]+)\s+(?:employees|workers|staff)/i, basicsContent),
      revenue: ext(/(?:revenue|sales)\s+(?:of\s+)?(\$[\d.]+\s*(?:billion|million|B|M))/i, basicsContent),
      industry: ext(/(?:industry|sector|market):\s*([^.\n]+)/i, basicsContent) || 'Technology',
      publicOrPrivate: /(?:publicly traded|NYSE|NASDAQ|stock ticker|IPO)/i.test(basicsContent)
        ? 'Public' : /private(?:ly held)?/i.test(basicsContent) ? 'Private' : 'Unknown',
      stockTicker: ext(/(?:ticker|symbol|NYSE|NASDAQ)[:\s]+([A-Z]{1,5})/i, basicsContent),
      mission: ext(/(?:mission|vision)\s+(?:is\s+)?(?:to\s+)?[""]?([^"".\n]+)/i, basicsContent),
      keyProducts: products.length > 0 ? products : ['See overview for details'],
      recentNews: news.length > 0 ? news : ['No recent news extracted'],
      sources: [...new Set(sources)],
    };
  }

  private emptyProfile(): OrgIntelligence {
    return {
      name: this.config.orgName, website: this.config.targetUrl, overview: '',
      founded: '', headquarters: '', ceo: '', employees: '', revenue: '',
      industry: '', publicOrPrivate: '', stockTicker: '', mission: '',
      keyProducts: [], recentNews: [], sources: [],
    };
  }
}

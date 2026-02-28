/**
 * ARGUS Security & Risk Agent
 *
 * Assesses the organization's security posture, compliance certifications,
 * historical breaches, regulatory risks, and supply chain vulnerabilities.
 *
 * Model routing:
 *   sonar               — breach/incident factual lookup (cheap, fast)
 *   sonar-reasoning-pro — risk analysis requiring multi-step reasoning
 */

import type { AgentResult, SecurityRiskIntelligence, AuditConfig } from '../types.js';
import { PerplexityClient } from '../perplexity-client.js';
import { ClaudeClient } from '../claude-client.js';

export class SecurityRiskAgent {
  private pplx: PerplexityClient;
  private claude: ClaudeClient;
  private config: AuditConfig;

  constructor(pplx: PerplexityClient, claude: ClaudeClient, config: AuditConfig) {
    this.pplx = pplx;
    this.claude = claude;
    this.config = config;
  }

  async execute(): Promise<AgentResult<SecurityRiskIntelligence>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const allSources: string[] = [];

    console.log(`[SEC] Initiating security & risk assessment for ${this.config.orgName}...`);

    let intel: SecurityRiskIntelligence = this.emptyIntel();

    try {
      // Phase 1: Factual security data via sonar (cheap — $1/$1 per 1M)
      console.log('[SEC] Phase 1 — Security facts via sonar...');
      const secFacts = await this.pplx.quickSearch(
        `${this.config.orgName} (${this.config.targetUrl}) cybersecurity profile: ` +
        `List any known data breaches or security incidents with dates and scale. ` +
        `What security certifications do they hold (SOC 2, ISO 27001, FedRAMP, HIPAA, PCI-DSS, etc.)? ` +
        `What is their privacy policy approach and GDPR compliance status? ` +
        `Any regulatory fines, FTC actions, or legal issues related to data security?`
      );
      allSources.push(...secFacts.citations);

      // Phase 2: Risk analysis via sonar-reasoning-pro ($2/$8 per 1M)
      console.log('[SEC] Phase 2 — Risk analysis via sonar-reasoning-pro...');
      const riskAnalysis = await this.pplx.analyze(
        `Conduct a multi-factor risk analysis of ${this.config.orgName} (${this.config.targetUrl}). ` +
        `Assess: (1) regulatory risks and government scrutiny, ` +
        `(2) reputation risks from controversies or public criticism, ` +
        `(3) supply chain and vendor dependency risks, ` +
        `(4) key business risks and strategic vulnerabilities. ` +
        `For each risk, rate the severity and provide evidence.`
      );
      allSources.push(...riskAnalysis.citations);

      intel = this.parseIntelligence(secFacts.content, riskAnalysis.content, allSources);

      if (this.claude.isAvailable && this.config.depth !== 'quick') {
        console.log('[SEC] Phase 3 — Claude risk synthesis...');
        const synthesis = await this.claude.synthesizeIntelligence(
          `Security Facts:\n${secFacts.content}\n\nRisk Analysis:\n${riskAnalysis.content}`,
          'Security & Risk Assessment'
        );
        if (synthesis) intel.overallPosture = synthesis;
      }
    } catch (e) {
      errors.push(`Security risk error: ${e}`);
      console.error(`[SEC] Error: ${e}`);
    }

    console.log(`[SEC] Complete — Risk score: ${intel.riskScore}/100`);

    return {
      agentId: 'sec-001',
      agentType: 'security-risk',
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
    secContent: string,
    riskContent: string,
    sources: string[]
  ): SecurityRiskIntelligence {
    const breaches = this.extractBreaches(secContent);
    const certs = this.extractCertifications(secContent);
    const incidents = this.extractByPattern(secContent, /incident|vulnerability|attack|exploit/i);
    const regRisks = this.extractByPattern(riskContent, /regulat|lawsuit|fine|penalty|investigation|antitrust|FTC|SEC|DOJ/i);
    const repRisks = this.extractByPattern(riskContent, /controvers|critic|backlash|scandal|protest|ethic/i);
    const supplyRisks = this.extractByPattern(riskContent, /supply\s*chain|depend|vendor|third.?party|concentrat/i);
    const privacy = this.extractSection(secContent, /privacy|GDPR|data\s+(?:protection|handling)/i);

    const riskScore = this.calculateRiskScore(breaches.length, incidents.length, regRisks.length, repRisks.length);

    return {
      overallPosture: secContent.slice(0, 2000),
      riskScore,
      knownBreaches: breaches,
      complianceCertifications: certs,
      privacyPolicySummary: privacy,
      dataHandlingPractices: this.extractSection(secContent, /data\s+handling|data\s+processing/i),
      securityIncidents: incidents,
      regulatoryRisks: regRisks,
      reputationRisks: repRisks,
      supplyChainRisks: supplyRisks,
      sources: [...new Set(sources)],
    };
  }

  private extractBreaches(content: string): SecurityRiskIntelligence['knownBreaches'] {
    return content.split('\n')
      .filter(l => /breach|hack|compromis|leak|expos(?:ed|ure)/i.test(l) && l.length > 30)
      .slice(0, 10)
      .map(l => ({
        date: l.match(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4})\b/i)?.[1] ?? 'Unknown',
        description: l.replace(/^[-•*\d.)\]]\s*/, '').trim().slice(0, 300),
        impact: 'See description',
        resolution: '',
      }));
  }

  private extractCertifications(content: string): string[] {
    const patterns = [
      /SOC\s*2/i, /ISO\s*27001/i, /FedRAMP/i, /HIPAA/i, /PCI[\s-]DSS/i,
      /GDPR/i, /SOX/i, /CCPA/i, /ISO\s*9001/i, /NIST/i, /CMMC/i,
      /StateRAMP/i, /ITAR/i, /ISO\s*42001/i, /CSA\s*STAR/i,
    ];
    const found: string[] = [];
    for (const p of patterns) {
      const m = content.match(p);
      if (m) found.push(m[0]);
    }
    return [...new Set(found)];
  }

  private extractByPattern(content: string, pattern: RegExp): string[] {
    return content.split('\n')
      .filter(l => pattern.test(l) && l.length > 20)
      .slice(0, 8)
      .map(l => l.replace(/^[-•*\d.)\]]\s*/, '').trim());
  }

  private extractSection(content: string, pattern: RegExp): string {
    const lines = content.split('\n');
    const idx = lines.findIndex(l => pattern.test(l));
    if (idx === -1) return '';
    return lines.slice(idx, idx + 5).join('\n').trim().slice(0, 500);
  }

  private calculateRiskScore(breaches: number, incidents: number, regRisks: number, repRisks: number): number {
    return Math.min(100, 25 + breaches * 12 + incidents * 5 + regRisks * 8 + repRisks * 4);
  }

  private emptyIntel(): SecurityRiskIntelligence {
    return {
      overallPosture: '', riskScore: 0, knownBreaches: [], complianceCertifications: [],
      privacyPolicySummary: '', dataHandlingPractices: '', securityIncidents: [],
      regulatoryRisks: [], reputationRisks: [], supplyChainRisks: [], sources: [],
    };
  }
}

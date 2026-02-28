/**
 * ARGUS Security & Risk Agent
 *
 * Assesses the organization's security posture, compliance certifications,
 * historical breaches, regulatory risks, and supply chain vulnerabilities
 * through open-source intelligence (OSINT).
 */

import type { AgentResult, SecurityRiskIntelligence, AuditConfig } from '../types.js';
import { PerplexityClient } from '../perplexity-client.js';
import { ClaudeClient } from '../claude-client.js';

export class SecurityRiskAgent {
  private perplexity: PerplexityClient;
  private claude: ClaudeClient;
  private config: AuditConfig;

  constructor(perplexity: PerplexityClient, claude: ClaudeClient, config: AuditConfig) {
    this.perplexity = perplexity;
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
      console.log('[SEC] Phase 1 — Security posture and breach history...');
      const secResearch = await this.perplexity.deepResearch(
        `${this.config.orgName} cybersecurity posture and data breach history`,
        [
          `Has ${this.config.orgName} experienced any data breaches, security incidents, or cyberattacks? Include dates, scale, and impact`,
          `What security certifications does ${this.config.orgName} hold? (SOC 2, ISO 27001, FedRAMP, HIPAA, PCI-DSS, etc.)`,
          `What is ${this.config.orgName}'s privacy policy and data handling approach? GDPR compliance?`,
          `Any regulatory actions, fines, or legal issues related to data security or privacy at ${this.config.orgName}?`,
          `What security products, features, or practices does ${this.config.orgName} publicly describe?`,
        ]
      );
      allSources.push(...secResearch.citations);

      console.log('[SEC] Phase 2 — Regulatory and reputation risks...');
      const riskResearch = await this.perplexity.deepResearch(
        `${this.config.orgName} regulatory risks, controversies, and reputation`,
        [
          `What regulatory challenges or government scrutiny has ${this.config.orgName} faced?`,
          `Any lawsuits, legal disputes, or ethical controversies involving ${this.config.orgName}?`,
          `What are the key business risks and vulnerabilities for ${this.config.orgName}?`,
          `Does ${this.config.orgName} have any supply chain risks or key dependencies?`,
          `What do critics and analysts say about ${this.config.orgName}'s risk profile?`,
        ]
      );
      allSources.push(...riskResearch.citations);

      intel = this.parseIntelligence(secResearch.content, riskResearch.content, allSources);

      if (this.claude.isAvailable && this.config.depth !== 'quick') {
        console.log('[SEC] Phase 3 — Claude risk synthesis...');
        const synthesis = await this.claude.synthesizeIntelligence(
          `Security Research:\n${secResearch.content}\n\nRisk Research:\n${riskResearch.content}`,
          'Security & Risk Assessment'
        );
        if (synthesis) {
          intel.overallPosture = synthesis;
        }
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
    const incidents = this.extractIncidents(secContent);
    const regRisks = this.extractRegulatoryRisks(riskContent);
    const repRisks = this.extractReputationRisks(riskContent);
    const supplyRisks = this.extractSupplyChainRisks(riskContent);
    const privacy = this.extractSection(secContent, /privacy|GDPR|data\s+(?:protection|handling)/i);

    const riskScore = this.calculateRiskScore(breaches, incidents, regRisks, repRisks);

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
    const breaches: SecurityRiskIntelligence['knownBreaches'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (/breach|hack|compromis|leak|expos(?:ed|ure)|incident/i.test(line) && line.length > 30) {
        const dateMatch = line.match(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4})\b/i);
        breaches.push({
          date: dateMatch?.[1] ?? 'Unknown date',
          description: line.replace(/^[-•*]\s*/, '').trim().slice(0, 300),
          impact: 'See description',
          resolution: '',
        });
      }
    }

    return breaches.slice(0, 10);
  }

  private extractCertifications(content: string): string[] {
    const certs: string[] = [];
    const certPatterns = [
      /SOC\s*2/i, /ISO\s*27001/i, /FedRAMP/i, /HIPAA/i, /PCI[\s-]DSS/i,
      /GDPR/i, /SOX/i, /CCPA/i, /ISO\s*9001/i, /NIST/i, /CMMC/i,
      /StateRAMP/i, /ITAR/i, /ISO\s*42001/i, /CSA\s*STAR/i,
    ];

    for (const pattern of certPatterns) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        if (match) certs.push(match[0]);
      }
    }

    return [...new Set(certs)];
  }

  private extractIncidents(content: string): string[] {
    return content
      .split('\n')
      .filter(l => /incident|vulnerability|attack|exploit/i.test(l) && l.length > 20)
      .slice(0, 8)
      .map(l => l.replace(/^[-•*]\s*/, '').trim());
  }

  private extractRegulatoryRisks(content: string): string[] {
    return content
      .split('\n')
      .filter(l => /regulat|lawsuit|fine|penalty|investigation|antitrust|FTC|SEC|DOJ/i.test(l) && l.length > 20)
      .slice(0, 8)
      .map(l => l.replace(/^[-•*]\s*/, '').trim());
  }

  private extractReputationRisks(content: string): string[] {
    return content
      .split('\n')
      .filter(l => /controvers|critic|backlash|scandal|protest|ethic/i.test(l) && l.length > 20)
      .slice(0, 8)
      .map(l => l.replace(/^[-•*]\s*/, '').trim());
  }

  private extractSupplyChainRisks(content: string): string[] {
    return content
      .split('\n')
      .filter(l => /supply\s*chain|depend|vendor|third.?party|concentrat/i.test(l) && l.length > 20)
      .slice(0, 5)
      .map(l => l.replace(/^[-•*]\s*/, '').trim());
  }

  private extractSection(content: string, pattern: RegExp): string {
    const lines = content.split('\n');
    const idx = lines.findIndex(l => pattern.test(l));
    if (idx === -1) return '';
    return lines.slice(idx, idx + 5).join('\n').trim().slice(0, 500);
  }

  private calculateRiskScore(
    breaches: unknown[],
    incidents: string[],
    regRisks: string[],
    repRisks: string[]
  ): number {
    let score = 25;
    score += breaches.length * 12;
    score += incidents.length * 5;
    score += regRisks.length * 8;
    score += repRisks.length * 4;
    return Math.min(100, score);
  }

  private emptyIntel(): SecurityRiskIntelligence {
    return {
      overallPosture: '',
      riskScore: 0,
      knownBreaches: [],
      complianceCertifications: [],
      privacyPolicySummary: '',
      dataHandlingPractices: '',
      securityIncidents: [],
      regulatoryRisks: [],
      reputationRisks: [],
      supplyChainRisks: [],
      sources: [],
    };
  }
}

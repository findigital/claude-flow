/**
 * ARGUS Technology Intelligence Agent
 *
 * Maps the organization's technology landscape: tech stack, AI/ML capabilities,
 * patents, engineering culture, open-source presence, and data strategy.
 *
 * Model routing:
 *   sonar-deep-research (low effort) — THE high-value deep research query.
 *     This is the one agent that justifies the expensive model because
 *     tech/AI capability mapping requires exhaustive source coverage.
 *   sonar — supplementary quick lookups if needed.
 */

import type { AgentResult, TechIntelligence, AuditConfig } from '../types.js';
import { PerplexityClient } from '../perplexity-client.js';
import { ClaudeClient } from '../claude-client.js';

export class TechIntelligenceAgent {
  private pplx: PerplexityClient;
  private claude: ClaudeClient;
  private config: AuditConfig;

  constructor(pplx: PerplexityClient, claude: ClaudeClient, config: AuditConfig) {
    this.pplx = pplx;
    this.claude = claude;
    this.config = config;
  }

  async execute(): Promise<AgentResult<TechIntelligence>> {
    const startTime = Date.now();
    const errors: string[] = [];
    const allSources: string[] = [];

    console.log(`[TECH] Mapping technology landscape for ${this.config.orgName}...`);

    let intel: TechIntelligence = this.emptyIntel();

    try {
      // Phase 1: Deep research on tech + AI — sonar-deep-research (low effort)
      // This is the ONE query we spend the premium model budget on.
      const effort = this.config.depth === 'deep' ? 'medium' as const : 'low' as const;
      console.log(`[TECH] Phase 1 — Deep tech/AI research via sonar-deep-research (effort: ${effort})...`);
      const techResearch = await this.pplx.deepResearch(
        `${this.config.orgName} (${this.config.targetUrl}) technology stack, AI capabilities, and engineering`,
        [
          `What programming languages, frameworks, and technologies does ${this.config.orgName} use? Include evidence from job postings, engineering blogs, and conference talks`,
          `What AI and machine learning products, features, or capabilities does ${this.config.orgName} offer or use internally? What models, frameworks, or approaches?`,
          `How does ${this.config.orgName} use generative AI, LLMs, or agent-based systems?`,
          `What is ${this.config.orgName}'s cloud infrastructure and data platform architecture?`,
          `What is ${this.config.orgName}'s open-source presence and engineering culture?`,
          `Any notable AI patents, research papers, or published technical work?`,
        ],
        effort
      );
      allSources.push(...techResearch.citations);

      intel = this.parseIntelligence(techResearch.content, allSources);

      // Phase 2 (optional): Claude for polished analytical synthesis
      if (this.claude.isAvailable && this.config.depth !== 'quick') {
        console.log('[TECH] Phase 2 — Claude deep analysis...');
        const synthesis = await this.claude.synthesizeIntelligence(
          techResearch.content,
          'Technology & AI Capability Assessment'
        );
        if (synthesis) intel.engineeringCulture = synthesis;
      }
    } catch (e) {
      errors.push(`Tech intelligence error: ${e}`);
      console.error(`[TECH] Error: ${e}`);
    }

    console.log(`[TECH] Complete — ${intel.aiCapabilities.length} AI capabilities identified`);

    return {
      agentId: 'tech-001',
      agentType: 'tech-intelligence',
      startTime,
      endTime: Date.now(),
      durationMs: Date.now() - startTime,
      status: errors.length > 0 ? 'partial' : 'success',
      data: intel,
      sources: [...new Set(allSources)],
      errors,
    };
  }

  private parseIntelligence(content: string, sources: string[]): TechIntelligence {
    return {
      techStack: this.extractTechStack(content),
      aiCapabilities: this.extractAICapabilities(content),
      patents: this.extractPatents(content),
      engineeringCulture: content.slice(0, 2000),
      openSourcePresence: this.extractSection(content, /open.?source/i),
      cloudInfrastructure: this.extractSection(content, /cloud|infrastructure|platform/i),
      dataStrategy: this.extractSection(content, /data\s+(?:strategy|platform|infrastructure)/i),
      techBlogHighlights: this.extractBlogHighlights(content),
      sources: [...new Set(sources)],
    };
  }

  private extractTechStack(content: string): TechIntelligence['techStack'] {
    const stack: TechIntelligence['techStack'] = [];

    const categories = [
      { name: 'Languages', pattern: /(?:programming\s+)?languages?\s*[:—]\s*([^\n.]+)/i },
      { name: 'Frontend', pattern: /(?:frontend|front-end|ui)\s*[:—]\s*([^\n.]+)/i },
      { name: 'Backend', pattern: /(?:backend|back-end|server)\s*[:—]\s*([^\n.]+)/i },
      { name: 'Cloud', pattern: /(?:cloud|aws|gcp|azure)\s*[:—]\s*([^\n.]+)/i },
      { name: 'Databases', pattern: /(?:database|data\s*store)\s*[:—]\s*([^\n.]+)/i },
      { name: 'DevOps', pattern: /(?:devops|ci\/cd|deployment)\s*[:—]\s*([^\n.]+)/i },
    ];

    for (const cat of categories) {
      const match = content.match(cat.pattern);
      if (match) {
        const techs = match[1].split(/[,;]/).map(t => t.trim()).filter(t => t.length > 1 && t.length < 50);
        if (techs.length > 0) {
          stack.push({
            category: cat.name, technologies: techs, confidence: 'MODERATE',
            evidence: `Extracted from research: "${match[0].slice(0, 80)}"`,
          });
        }
      }
    }

    // Keyword-based fallback detection
    const techKeywords = [
      'Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C++', 'Scala',
      'React', 'Angular', 'Vue', 'Node.js', 'Django', 'Flask', 'Spring',
      'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'Spark',
      'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Terraform',
    ];

    const found = techKeywords.filter(kw =>
      new RegExp(`\\b${kw.replace('+', '\\+')}\\b`, 'i').test(content)
    );

    if (found.length > 0 && stack.length === 0) {
      stack.push({
        category: 'Detected Technologies', technologies: found,
        confidence: 'MODERATE', evidence: 'Keyword detection from research',
      });
    }

    return stack;
  }

  private extractAICapabilities(content: string): TechIntelligence['aiCapabilities'] {
    const caps: TechIntelligence['aiCapabilities'] = [];
    const lines = content.split('\n');

    const patterns = [
      { p: /(?:machine\s+learning|ML)\s+(?:model|system|platform|pipeline)/i, c: 'Machine Learning Platform', m: 'production' as const },
      { p: /(?:natural\s+language|NLP|language\s+model|LLM)/i, c: 'Natural Language Processing', m: 'production' as const },
      { p: /(?:computer\s+vision|image\s+recognition|object\s+detection)/i, c: 'Computer Vision', m: 'production' as const },
      { p: /(?:generative\s+AI|GenAI|GPT|large\s+language)/i, c: 'Generative AI', m: 'development' as const },
      { p: /(?:recommendation|recommender)\s+(?:system|engine)/i, c: 'Recommendation System', m: 'production' as const },
      { p: /(?:autonomous|self-driving|robotics)/i, c: 'Autonomous Systems', m: 'research' as const },
      { p: /(?:knowledge\s+graph|ontology|semantic)/i, c: 'Knowledge Graph / Ontology', m: 'production' as const },
      { p: /(?:predictive\s+analytics|forecasting)/i, c: 'Predictive Analytics', m: 'production' as const },
      { p: /(?:agent|agentic|multi-agent)/i, c: 'AI Agents', m: 'development' as const },
      { p: /(?:deep\s+learning|neural\s+network|transformer)/i, c: 'Deep Learning', m: 'production' as const },
      { p: /(?:embeddings|vector\s+(?:search|database|store))/i, c: 'Vector/Embedding Systems', m: 'production' as const },
      { p: /(?:RAG|retrieval.augmented)/i, c: 'RAG Pipeline', m: 'development' as const },
    ];

    for (const { p, c, m } of patterns) {
      const hits = lines.filter(l => p.test(l));
      if (hits.length > 0) {
        caps.push({
          capability: c,
          description: hits[0].replace(/^[-•*\d.)\]]\s*/, '').trim().slice(0, 200),
          maturity: m,
          products: [],
          confidence: hits.length > 1 ? 'HIGH' : 'MODERATE',
        });
      }
    }

    return caps;
  }

  private extractPatents(content: string): TechIntelligence['patents'] {
    return content.split('\n')
      .filter(l => /patent/i.test(l))
      .slice(0, 10)
      .map(l => ({
        title: l.replace(/^[-•*\d.)\]]\s*/, '').trim().slice(0, 200),
        area: 'AI/Technology',
        year: l.match(/\b(20\d{2})\b/)?.[1] ?? 'Unknown',
        relevance: 'Identified in research',
      }));
  }

  private extractBlogHighlights(content: string): string[] {
    return content.split('\n')
      .filter(l => /blog|article|post|published|wrote/i.test(l))
      .slice(0, 5)
      .map(l => l.replace(/^[-•*\d.)\]]\s*/, '').trim());
  }

  private extractSection(content: string, pattern: RegExp): string {
    const lines = content.split('\n');
    const idx = lines.findIndex(l => pattern.test(l));
    if (idx === -1) return '';
    return lines.slice(idx, idx + 5).join('\n').trim().slice(0, 500);
  }

  private emptyIntel(): TechIntelligence {
    return {
      techStack: [], aiCapabilities: [], patents: [],
      engineeringCulture: '', openSourcePresence: '', cloudInfrastructure: '',
      dataStrategy: '', techBlogHighlights: [], sources: [],
    };
  }
}

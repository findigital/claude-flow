/**
 * ARGUS Technology Intelligence Agent
 *
 * Maps the organization's technology landscape: tech stack, AI/ML capabilities,
 * patents, engineering culture, open-source presence, and data strategy.
 */

import type { AgentResult, TechIntelligence, AuditConfig } from '../types.js';
import { PerplexityClient } from '../perplexity-client.js';
import { ClaudeClient } from '../claude-client.js';

export class TechIntelligenceAgent {
  private perplexity: PerplexityClient;
  private claude: ClaudeClient;
  private config: AuditConfig;

  constructor(perplexity: PerplexityClient, claude: ClaudeClient, config: AuditConfig) {
    this.perplexity = perplexity;
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
      console.log('[TECH] Phase 1 — Technology stack and infrastructure...');
      const techResearch = await this.perplexity.deepResearch(
        `${this.config.orgName} technology stack and engineering infrastructure`,
        [
          `What programming languages, frameworks, and technologies does ${this.config.orgName} use? Include job posting evidence, engineering blog posts, and conference talks`,
          `What is ${this.config.orgName}'s cloud infrastructure and platform architecture?`,
          `Does ${this.config.orgName} have an engineering blog or tech blog? What are the key technical topics they write about?`,
          `What is ${this.config.orgName}'s open-source presence? Any notable open-source projects or GitHub organizations?`,
          `What databases, data platforms, and data infrastructure does ${this.config.orgName} use?`,
        ]
      );
      allSources.push(...techResearch.citations);

      console.log('[TECH] Phase 2 — AI and machine learning capabilities...');
      const aiResearch = await this.perplexity.deepResearch(
        `${this.config.orgName} artificial intelligence and machine learning capabilities`,
        [
          `What AI and machine learning products, features, or capabilities does ${this.config.orgName} offer?`,
          `What AI/ML frameworks, models, or approaches does ${this.config.orgName} use internally?`,
          `Does ${this.config.orgName} have any AI research papers, patents, or published work?`,
          `How does ${this.config.orgName} use generative AI, LLMs, or agent-based systems?`,
          `What is ${this.config.orgName}'s AI strategy and roadmap based on public statements?`,
        ]
      );
      allSources.push(...aiResearch.citations);

      intel = this.parseIntelligence(techResearch.content, aiResearch.content, allSources);

      if (this.claude.isAvailable && this.config.depth !== 'quick') {
        console.log('[TECH] Phase 3 — Claude deep analysis...');
        const synthesis = await this.claude.synthesizeIntelligence(
          `Technology Stack Research:\n${techResearch.content}\n\nAI Capabilities Research:\n${aiResearch.content}`,
          'Technology & AI Capability Assessment'
        );
        if (synthesis) {
          intel.engineeringCulture = synthesis;
        }
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

  private parseIntelligence(
    techContent: string,
    aiContent: string,
    sources: string[]
  ): TechIntelligence {
    const techStack = this.extractTechStack(techContent);
    const aiCapabilities = this.extractAICapabilities(aiContent);
    const patents = this.extractPatents(aiContent);
    const blogHighlights = this.extractBlogHighlights(techContent);

    return {
      techStack,
      aiCapabilities,
      patents,
      engineeringCulture: techContent.slice(0, 2000),
      openSourcePresence: this.extractSection(techContent, /open.?source/i),
      cloudInfrastructure: this.extractSection(techContent, /cloud|infrastructure|platform/i),
      dataStrategy: this.extractSection(aiContent, /data\s+(?:strategy|platform|infrastructure)/i),
      techBlogHighlights: blogHighlights,
      sources: [...new Set(sources)],
    };
  }

  private extractTechStack(content: string): TechIntelligence['techStack'] {
    const categories = [
      { name: 'Languages', pattern: /(?:programming\s+)?languages?\s*[:—]\s*([^\n.]+)/i },
      { name: 'Frontend', pattern: /(?:frontend|front-end|ui)\s*[:—]\s*([^\n.]+)/i },
      { name: 'Backend', pattern: /(?:backend|back-end|server)\s*[:—]\s*([^\n.]+)/i },
      { name: 'Cloud', pattern: /(?:cloud|aws|gcp|azure)\s*[:—]\s*([^\n.]+)/i },
      { name: 'Databases', pattern: /(?:database|data\s*store)\s*[:—]\s*([^\n.]+)/i },
      { name: 'DevOps', pattern: /(?:devops|ci\/cd|deployment)\s*[:—]\s*([^\n.]+)/i },
    ];

    const stack: TechIntelligence['techStack'] = [];

    for (const cat of categories) {
      const match = content.match(cat.pattern);
      if (match) {
        const techs = match[1]
          .split(/[,;]/)
          .map(t => t.trim())
          .filter(t => t.length > 1 && t.length < 50);

        if (techs.length > 0) {
          stack.push({
            category: cat.name,
            technologies: techs,
            confidence: 'MODERATE',
            evidence: `Extracted from research: "${match[0].slice(0, 100)}"`,
          });
        }
      }
    }

    const techKeywords = [
      'Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'C++', 'Scala',
      'React', 'Angular', 'Vue', 'Node.js', 'Django', 'Flask', 'Spring',
      'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'Spark',
      'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Terraform',
    ];

    const foundTechs = techKeywords.filter(kw =>
      new RegExp(`\\b${kw.replace('+', '\\+')}\\b`, 'i').test(content)
    );

    if (foundTechs.length > 0 && stack.length === 0) {
      stack.push({
        category: 'Detected Technologies',
        technologies: foundTechs,
        confidence: 'MODERATE',
        evidence: 'Keyword detection from research content',
      });
    }

    return stack;
  }

  private extractAICapabilities(content: string): TechIntelligence['aiCapabilities'] {
    const caps: TechIntelligence['aiCapabilities'] = [];
    const lines = content.split('\n');

    const aiKeywords = [
      { pattern: /(?:machine\s+learning|ML)\s+(?:model|system|platform|pipeline)/i, cap: 'Machine Learning Platform', mat: 'production' as const },
      { pattern: /(?:natural\s+language|NLP|language\s+model|LLM)/i, cap: 'Natural Language Processing', mat: 'production' as const },
      { pattern: /(?:computer\s+vision|image\s+recognition|object\s+detection)/i, cap: 'Computer Vision', mat: 'production' as const },
      { pattern: /(?:generative\s+AI|GenAI|GPT|large\s+language)/i, cap: 'Generative AI', mat: 'development' as const },
      { pattern: /(?:recommendation|recommender)\s+(?:system|engine)/i, cap: 'Recommendation System', mat: 'production' as const },
      { pattern: /(?:autonomous|self-driving|robotics)/i, cap: 'Autonomous Systems', mat: 'research' as const },
      { pattern: /(?:knowledge\s+graph|ontology|semantic)/i, cap: 'Knowledge Graph', mat: 'production' as const },
      { pattern: /(?:predictive\s+analytics|forecasting)/i, cap: 'Predictive Analytics', mat: 'production' as const },
      { pattern: /(?:agent|agentic|multi-agent)/i, cap: 'AI Agents', mat: 'development' as const },
      { pattern: /(?:deep\s+learning|neural\s+network|transformer)/i, cap: 'Deep Learning', mat: 'production' as const },
    ];

    for (const kw of aiKeywords) {
      const matchingLines = lines.filter(l => kw.pattern.test(l));
      if (matchingLines.length > 0) {
        caps.push({
          capability: kw.cap,
          description: matchingLines[0].replace(/^[-•*]\s*/, '').trim().slice(0, 200),
          maturity: kw.mat,
          products: [],
          confidence: matchingLines.length > 1 ? 'HIGH' : 'MODERATE',
        });
      }
    }

    return caps;
  }

  private extractPatents(content: string): TechIntelligence['patents'] {
    const patents: TechIntelligence['patents'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (/patent/i.test(line)) {
        const yearMatch = line.match(/\b(20\d{2})\b/);
        patents.push({
          title: line.replace(/^[-•*]\s*/, '').trim().slice(0, 200),
          area: 'AI/Technology',
          year: yearMatch?.[1] ?? 'Unknown',
          relevance: 'Identified in research',
        });
      }
    }

    return patents.slice(0, 10);
  }

  private extractBlogHighlights(content: string): string[] {
    return content
      .split('\n')
      .filter(l => /blog|article|post|published|wrote/i.test(l))
      .slice(0, 5)
      .map(l => l.replace(/^[-•*]\s*/, '').trim());
  }

  private extractSection(content: string, pattern: RegExp): string {
    const lines = content.split('\n');
    const idx = lines.findIndex(l => pattern.test(l));
    if (idx === -1) return '';
    return lines.slice(idx, idx + 5).join('\n').trim().slice(0, 500);
  }

  private emptyIntel(): TechIntelligence {
    return {
      techStack: [],
      aiCapabilities: [],
      patents: [],
      engineeringCulture: '',
      openSourcePresence: '',
      cloudInfrastructure: '',
      dataStrategy: '',
      techBlogHighlights: [],
      sources: [],
    };
  }
}

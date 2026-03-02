/**
 * Perplexity Sonar Multi-Model Research Client
 *
 * Routes queries to the optimal Perplexity model based on task requirements:
 *
 *   sonar                — $1/$1 per 1M tokens. Fast factual lookups.
 *   sonar-reasoning-pro  — $2/$8 per 1M tokens. Multi-step CoT analysis.
 *   sonar-deep-research  — $2/$8 + $3/1M reasoning + $5/1K searches.
 *                          Exhaustive research across hundreds of sources.
 *
 * Supports reasoning_effort (low/medium/high) for deep-research cost control.
 */

import type { ResearchResult } from './types.js';

export type PerplexityModel =
  | 'sonar'
  | 'sonar-pro'
  | 'sonar-reasoning-pro'
  | 'sonar-deep-research';

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface QueryOptions {
  model?: PerplexityModel;
  reasoningEffort?: ReasoningEffort;
  systemPrompt?: string;
}

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  citations?: string[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    reasoning_tokens?: number;
    citation_tokens?: number;
  };
}

interface CostEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  citationTokens: number;
  estimatedCost: number;
}

const MODEL_PRICING: Record<PerplexityModel, { input: number; output: number; reasoning: number; citation: number }> = {
  'sonar':                { input: 1,  output: 1,  reasoning: 0, citation: 0 },
  'sonar-pro':            { input: 3,  output: 15, reasoning: 0, citation: 0 },
  'sonar-reasoning-pro':  { input: 2,  output: 8,  reasoning: 0, citation: 0 },
  'sonar-deep-research':  { input: 2,  output: 8,  reasoning: 3, citation: 2 },
};

const DEFAULT_SYSTEM_PROMPT = [
  'You are a senior intelligence analyst at a top-tier strategic consulting firm.',
  'Provide detailed, factual, well-sourced analysis.',
  'Include specific data points, dates, and figures whenever available.',
  'Distinguish between confirmed facts and assessments.',
  'If information is uncertain, state confidence level explicitly.',
].join(' ');

export class PerplexityClient {
  private apiKey: string;
  private defaultModel: PerplexityModel;
  private baseUrl = 'https://api.perplexity.ai/chat/completions';
  private costLog: CostEntry[] = [];
  private queryCount = 0;

  constructor(apiKey?: string, defaultModel?: string) {
    this.apiKey = apiKey ?? process.env.PERPLEXITY_API_KEY ?? '';
    this.defaultModel = (defaultModel as PerplexityModel) ?? 'sonar';

    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY is required.');
    }
  }

  /**
   * Quick factual lookup — uses sonar ($1/$1 per 1M tokens).
   * Best for: org basics, simple factual questions, data points.
   */
  async quickSearch(query: string, systemPrompt?: string): Promise<ResearchResult> {
    return this.research(query, { model: 'sonar', systemPrompt });
  }

  /**
   * Analytical reasoning query — uses sonar-reasoning-pro ($2/$8 per 1M tokens).
   * Best for: multi-step analysis, risk assessment, competitive comparison.
   */
  async analyze(query: string, systemPrompt?: string): Promise<ResearchResult> {
    return this.research(query, { model: 'sonar-reasoning-pro', systemPrompt });
  }

  /**
   * Deep exhaustive research — uses sonar-deep-research.
   * Most expensive. Use sparingly for highest-value queries.
   * reasoning_effort controls depth vs cost: low ($5/1K), medium ($8/1K), high ($12/1K).
   */
  async deepResearch(
    topic: string,
    focusAreas: string[],
    effort: ReasoningEffort = 'low'
  ): Promise<ResearchResult> {
    const focusList = focusAreas.map((a, i) => `${i + 1}. ${a}`).join('\n');
    const query = [
      `Conduct comprehensive research on: ${topic}`,
      '',
      'Focus areas:',
      focusList,
      '',
      'For each area, provide:',
      '- Specific facts with dates and figures',
      '- Named sources and references',
      '- Confidence assessment of each claim',
    ].join('\n');

    return this.research(query, {
      model: 'sonar-deep-research',
      reasoningEffort: effort,
    });
  }

  /**
   * General-purpose research with explicit model selection.
   */
  async research(query: string, options: QueryOptions = {}): Promise<ResearchResult> {
    this.queryCount++;
    const model = options.model ?? this.defaultModel;

    const messages: PerplexityMessage[] = [
      { role: 'system', content: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT },
      { role: 'user', content: query },
    ];

    const response = await this.callApi(model, messages, options.reasoningEffort);

    this.trackCost(model, response);

    return {
      query,
      content: response.choices[0]?.message?.content ?? '',
      citations: response.citations ?? [],
      model: response.model ?? model,
      timestamp: new Date().toISOString(),
    };
  }

  get totalQueries(): number {
    return this.queryCount;
  }

  /** Returns estimated total cost in USD across all queries. */
  get totalCostUsd(): number {
    return this.costLog.reduce((sum, e) => sum + e.estimatedCost, 0);
  }

  /** Returns full cost breakdown by query. */
  get costBreakdown(): CostEntry[] {
    return [...this.costLog];
  }

  /** Returns summary of queries per model. */
  get modelUsageSummary(): Record<string, { queries: number; estimatedCost: number }> {
    const summary: Record<string, { queries: number; estimatedCost: number }> = {};
    for (const entry of this.costLog) {
      if (!summary[entry.model]) {
        summary[entry.model] = { queries: 0, estimatedCost: 0 };
      }
      summary[entry.model].queries++;
      summary[entry.model].estimatedCost += entry.estimatedCost;
    }
    return summary;
  }

  private async callApi(
    model: PerplexityModel,
    messages: PerplexityMessage[],
    reasoningEffort?: ReasoningEffort,
    retries = 3
  ): Promise<PerplexityResponse> {
    const body: Record<string, unknown> = { model, messages };

    if (reasoningEffort && (model === 'sonar-deep-research' || model === 'sonar-reasoning-pro')) {
      body.reasoning_effort = reasoningEffort;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return res.json() as Promise<PerplexityResponse>;
      }

      if (res.status === 429 && attempt < retries) {
        const waitSec = 15 * (attempt + 1);
        console.log(`    [RATE-LIMIT] ${model} — waiting ${waitSec}s (retry ${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }

      const errorText = await res.text();
      throw new Error(`Perplexity ${model} error (${res.status}): ${errorText}`);
    }

    throw new Error(`Perplexity ${model}: max retries exceeded`);
  }

  private trackCost(model: PerplexityModel, response: PerplexityResponse): void {
    const usage = response.usage ?? {};
    const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['sonar'];

    const inputTokens = usage.prompt_tokens ?? 0;
    const outputTokens = usage.completion_tokens ?? 0;
    const reasoningTokens = usage.reasoning_tokens ?? 0;
    const citationTokens = usage.citation_tokens ?? 0;

    const cost =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output +
      (reasoningTokens / 1_000_000) * pricing.reasoning +
      (citationTokens / 1_000_000) * pricing.citation;

    this.costLog.push({
      model,
      inputTokens,
      outputTokens,
      reasoningTokens,
      citationTokens,
      estimatedCost: Math.round(cost * 10000) / 10000,
    });
  }
}

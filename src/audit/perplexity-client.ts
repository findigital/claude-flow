/**
 * Perplexity Sonar Deep Research Client
 *
 * Provides structured research queries against the Perplexity API
 * using the sonar-deep-research model for comprehensive intelligence gathering.
 */

import type { ResearchResult } from './types.js';

interface PerplexityMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
}

export class PerplexityClient {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.perplexity.ai/chat/completions';
  private queryCount = 0;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.PERPLEXITY_API_KEY ?? '';
    this.model = model ?? process.env.PERPLEXITY_MODEL ?? 'sonar-deep-research';

    if (!this.apiKey) {
      throw new Error('PERPLEXITY_API_KEY is required. Set it as an environment variable or pass it directly.');
    }
  }

  async research(
    query: string,
    systemPrompt?: string
  ): Promise<ResearchResult> {
    this.queryCount++;
    const defaultSystem = [
      'You are a senior intelligence analyst at a top-tier strategic consulting firm.',
      'Provide detailed, factual, well-sourced analysis.',
      'Include specific data points, dates, and figures whenever available.',
      'Distinguish between confirmed facts and assessments.',
      'If information is uncertain, state confidence level explicitly.',
    ].join(' ');

    const messages: PerplexityMessage[] = [
      { role: 'system', content: systemPrompt ?? defaultSystem },
      { role: 'user', content: query },
    ];

    const response = await this.callApi(messages);

    return {
      query,
      content: response.choices[0]?.message?.content ?? '',
      citations: response.citations ?? [],
      model: response.model ?? this.model,
      timestamp: new Date().toISOString(),
    };
  }

  async deepResearch(
    topic: string,
    focusAreas: string[]
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
      '- Any notable gaps in available information',
    ].join('\n');

    return this.research(query);
  }

  get totalQueries(): number {
    return this.queryCount;
  }

  private async callApi(messages: PerplexityMessage[]): Promise<PerplexityResponse> {
    const body = {
      model: this.model,
      messages,
    };

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Perplexity API error (${res.status}): ${errorText}`);
    }

    return res.json() as Promise<PerplexityResponse>;
  }
}

/**
 * Anthropic Claude Analysis Client
 *
 * Provides advanced synthesis, analytical reasoning, and
 * Palantir-style intelligence report writing capabilities.
 */

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

export class ClaudeClient {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://api.anthropic.com/v1/messages';
  private available: boolean;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.model = model ?? 'claude-sonnet-4-20250514';
    this.available = !!this.apiKey;
  }

  get isAvailable(): boolean {
    return this.available;
  }

  async analyze(
    prompt: string,
    systemPrompt?: string,
    maxTokens = 4096
  ): Promise<string> {
    if (!this.available) {
      return '';
    }

    const defaultSystem = [
      'You are a senior intelligence analyst writing for a Palantir-style strategic intelligence product.',
      'Write with precision, authority, and analytical rigor.',
      'Use structured formats: headers, bullet points, risk ratings.',
      'Distinguish CONFIRMED facts from ASSESSED judgments.',
      'Assign confidence levels: HIGH / MODERATE / LOW.',
      'Be concise but comprehensive. Every sentence should carry information value.',
    ].join(' ');

    const messages: ClaudeMessage[] = [
      { role: 'user', content: prompt },
    ];

    const body = {
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt ?? defaultSystem,
      messages,
    };

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[CLAUDE] API error (${res.status}): ${errorText.slice(0, 200)}`);
        this.available = false;
        return '';
      }

      const data = await res.json() as ClaudeResponse;
      return data.content?.[0]?.text ?? '';
    } catch (e) {
      console.warn(`[CLAUDE] Request failed: ${e}`);
      this.available = false;
      return '';
    }
  }

  async synthesizeIntelligence(
    rawFindings: string,
    analysisType: string
  ): Promise<string> {
    const prompt = [
      `## Intelligence Synthesis Task: ${analysisType}`,
      '',
      'You are producing a section of a classified intelligence assessment.',
      'Transform the following raw research findings into a polished intelligence product.',
      '',
      '### Requirements:',
      '- Executive-level language, direct and authoritative',
      '- Lead with the bottom line (BLUF — Bottom Line Up Front)',
      '- Assign confidence levels to key assessments',
      '- Identify intelligence gaps and collection requirements',
      '- Flag any indicators requiring continued monitoring',
      '- Use structured formatting with clear section headers',
      '',
      '### Raw Findings:',
      rawFindings,
    ].join('\n');

    return this.analyze(prompt);
  }

  async generateExecutiveSummary(
    allFindings: Record<string, string>
  ): Promise<string> {
    const sections = Object.entries(allFindings)
      .map(([section, content]) => `### ${section}\n${content}`)
      .join('\n\n');

    const prompt = [
      '## Executive Intelligence Summary Generation',
      '',
      'Produce a 500-word executive summary suitable for C-suite briefing.',
      'This is the opening section of a comprehensive organizational audit.',
      '',
      '### Format:',
      '- BLUF (Bottom Line Up Front) — 2-3 sentences capturing the essential assessment',
      '- KEY FINDINGS — 4-6 bullet points of the most significant discoveries',
      '- RISK ASSESSMENT — Overall threat/opportunity posture in 2-3 sentences',
      '- RECOMMENDED ACTIONS — 3-4 immediate priorities',
      '',
      '### Source Material:',
      sections,
    ].join('\n');

    return this.analyze(prompt, undefined, 2048);
  }

  async generateStrategicRecommendations(
    orgContext: string,
    findings: string
  ): Promise<string> {
    const prompt = [
      '## Strategic Recommendations Generation',
      '',
      'Produce 8-12 strategic recommendations based on the audit findings.',
      '',
      'For each recommendation provide:',
      '- **Priority**: IMMEDIATE / SHORT-TERM / MEDIUM-TERM / LONG-TERM',
      '- **Category**: Security / Technology / AI Strategy / Governance / Market',
      '- **Title**: Clear action-oriented title',
      '- **Description**: What specifically should be done',
      '- **Rationale**: Why this matters, tied to specific findings',
      '- **Effort**: low / medium / high',
      '- **Impact**: low / medium / high / critical',
      '',
      '### Organization Context:',
      orgContext,
      '',
      '### Audit Findings:',
      findings,
    ].join('\n');

    return this.analyze(prompt, undefined, 4096);
  }
}

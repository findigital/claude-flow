/**
 * ARGUS — Agent-based Research & Governance Unified Scanner
 *
 * Entry point. Parses command-line arguments and launches the audit swarm.
 *
 * Usage:
 *   npx tsx src/audit/index.ts <organization-url> [options]
 *
 * Examples:
 *   npx tsx src/audit/index.ts https://palantir.com
 *   npx tsx src/audit/index.ts https://stripe.com --depth deep
 *   npx tsx src/audit/index.ts https://openai.com --depth quick --output ./reports
 */

import { AuditOrchestrator } from './orchestrator.js';
import type { AuditConfig } from './types.js';

function extractOrgName(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.replace(/^www\./, '').split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return url.replace(/https?:\/\//, '').replace(/[/.].*/, '');
  }
}

function normalizeUrl(input: string): string {
  if (!input.startsWith('http://') && !input.startsWith('https://')) {
    return `https://${input}`;
  }
  return input;
}

function parseArgs(argv: string[]): AuditConfig {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
  ARGUS — Agent-based Research & Governance Unified Scanner
  Palantir-style AI audit via Perplexity Sonar deep research + Claude analysis

  Usage:
    npx tsx src/audit/index.ts <organization-url> [options]

  Arguments:
    <organization-url>    Website URL of the organization to audit

  Options:
    --depth <level>       Research depth: quick | standard | deep (default: standard)
    --output <dir>        Output directory for the report (default: ./output/audits)
    --name <name>         Override organization name detection
    --help, -h            Show this help message

  Environment Variables:
    PERPLEXITY_API_KEY    Required — Perplexity Sonar API key
    PERPLEXITY_MODEL      Optional — Model name (default: sonar-deep-research)
    ANTHROPIC_API_KEY     Optional — Enables Claude-powered analysis synthesis

  Examples:
    npx tsx src/audit/index.ts https://palantir.com
    npx tsx src/audit/index.ts https://stripe.com --depth deep
    npx tsx src/audit/index.ts openai.com --depth quick --name OpenAI
    `);
    process.exit(0);
  }

  const targetUrl = normalizeUrl(args[0]);

  const flagIndex = (flag: string) => args.indexOf(flag);
  const flagValue = (flag: string, defaultVal: string) => {
    const idx = flagIndex(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
  };

  const depth = flagValue('--depth', 'standard') as AuditConfig['depth'];
  const outputDir = flagValue('--output', './output/audits');
  const nameOverride = flagValue('--name', '');
  const orgName = nameOverride || extractOrgName(targetUrl);

  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('ERROR: PERPLEXITY_API_KEY environment variable is required.');
    console.error('Set it with: export PERPLEXITY_API_KEY=pplx-your-key');
    process.exit(1);
  }

  return {
    targetUrl,
    orgName,
    depth,
    outputDir,
    enableClaude: !!process.env.ANTHROPIC_API_KEY,
    perplexityModel: process.env.PERPLEXITY_MODEL ?? 'sonar-deep-research',
  };
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv);

  console.log(`[ARGUS] Starting audit of ${config.orgName} (${config.targetUrl})`);
  console.log(`[ARGUS] Depth: ${config.depth} | Claude: ${config.enableClaude ? 'ON' : 'OFF'}`);

  const orchestrator = new AuditOrchestrator(config);

  try {
    const report = await orchestrator.execute();
    console.log(`\n[ARGUS] Report ${report.metadata.reportId} generated successfully.`);
    console.log(`[ARGUS] ${report.allSources.length} sources | ${report.metadata.researchQueries} queries | ${(report.metadata.totalDurationMs / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error(`\n[ARGUS] Fatal error: ${e}`);
    process.exit(1);
  }
}

main();

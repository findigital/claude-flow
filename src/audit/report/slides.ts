/**
 * ARGUS Presentation Generator — Canva-Quality Intelligence Deck
 *
 * Produces a polished, content-rich HTML slide presentation that reflects
 * the full depth of the ARGUS intelligence report. Each slide extracts
 * and distills the strongest findings from the research.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { AuditReport, AGENTFramework } from '../types.js';

interface Slide {
  id: string;
  layout: 'cover' | 'section' | 'keystat' | 'bullets' | 'table' | 'twocol' | 'quote' | 'closing';
  sectionTag?: string;
  title: string;
  subtitle?: string;
  stat?: { value: string; label: string };
  leftCol?: string[];
  rightCol?: string[];
  bullets?: string[];
  secondaryBullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  content?: string;
  footer?: string;
  accent?: string;
}

export class SlideGenerator {
  generate(report: AuditReport, outputDir: string): string {
    mkdirSync(outputDir, { recursive: true });

    const slides = this.buildSlides(report);
    const html = this.renderHTML(slides, report);

    const filename = `ARGUS-${report.metadata.targetOrg.replace(/\W+/g, '-')}-Slides.html`;
    const path = join(outputDir, filename);
    writeFileSync(path, html, 'utf-8');

    const jsonPath = join(outputDir, filename.replace('.html', '.json'));
    writeFileSync(jsonPath, JSON.stringify({ slides, metadata: report.metadata }, null, 2), 'utf-8');

    return path;
  }

  private buildSlides(r: AuditReport): Slide[] {
    const s: Slide[] = [];
    const o = r.orgIntelligence;
    const t = r.techIntelligence;
    const sec = r.securityRisk;
    const comp = r.competitiveIntel;
    const gov = r.aiGovernance;
    const af = gov?.agentFramework;

    // ── 1. COVER ──────────────────────────────────────
    s.push({
      id: 'cover', layout: 'cover',
      title: `${o.name}`,
      subtitle: 'Organizational Intelligence Assessment',
      content: [
        r.metadata.classification,
        `Report ${r.metadata.reportId}`,
        new Date(r.metadata.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        `${r.allSources.length} Sources Analyzed`,
      ].join('  ·  '),
      footer: r.metadata.generatedBy,
    });

    // ── 2. BLUF ──────────────────────────────────────
    const bluf = this.extractBLUF(r.executiveSummary);
    s.push({
      id: 'bluf', layout: 'section', sectionTag: 'EXECUTIVE SUMMARY',
      title: 'Bottom Line Up Front',
      content: bluf.statement,
      bullets: bluf.keyFindings,
      accent: '#58a6ff',
    });

    // ── 3. KEY METRICS ───────────────────────────────
    const metrics = this.buildMetrics(r);
    s.push({
      id: 'metrics', layout: 'keystat', sectionTag: 'KEY METRICS',
      title: 'Intelligence At A Glance',
      stat: metrics[0],
      bullets: metrics.slice(1).map(m => `${m.value}  ${m.label}`),
    });

    // ── 4. ORG PROFILE ───────────────────────────────
    const profileRows: string[][] = [];
    if (o.industry) profileRows.push(['Industry', o.industry]);
    if (o.founded) profileRows.push(['Founded', o.founded]);
    if (o.headquarters) profileRows.push(['HQ', o.headquarters]);
    if (o.ceo) profileRows.push(['CEO', o.ceo]);
    if (o.employees) profileRows.push(['Employees', o.employees]);
    if (o.revenue) profileRows.push(['Revenue', o.revenue]);
    if (o.publicOrPrivate) profileRows.push(['Status', o.publicOrPrivate + (o.stockTicker ? ` (${o.stockTicker})` : '')]);

    s.push({
      id: 'profile', layout: 'twocol', sectionTag: 'ORGANIZATION',
      title: `${o.name} — Corporate Profile`,
      leftCol: profileRows.map(([k, v]) => `${k}: ${v}`),
      rightCol: o.keyProducts.filter(p => p !== 'See overview for details').slice(0, 6),
      subtitle: o.keyProducts.length > 0 ? 'Key Products & Services' : undefined,
    });

    // ── 5. RECENT DEVELOPMENTS ────────────────────────
    const news = o.recentNews.filter(n => n !== 'No recent news extracted' && n.length > 15);
    if (news.length > 0) {
      s.push({
        id: 'news', layout: 'bullets', sectionTag: 'RECENT INTELLIGENCE',
        title: 'Key Developments (Past 12 Months)',
        bullets: news.slice(0, 6),
      });
    }

    // ── 6. TECHNOLOGY ─────────────────────────────────
    if (t.techStack.length > 0 || t.aiCapabilities.length > 0) {
      s.push({
        id: 'tech-overview', layout: 'twocol', sectionTag: 'TECHNOLOGY',
        title: 'Technology Landscape',
        leftCol: t.techStack.slice(0, 5).map(ts =>
          `${ts.category}: ${ts.technologies.slice(0, 4).join(', ')}`
        ),
        rightCol: [
          `${t.aiCapabilities.length} AI capabilities detected`,
          `${t.techStack.length} technology categories mapped`,
          t.openSourcePresence ? `Open source: Active` : '',
          t.cloudInfrastructure ? 'Cloud infrastructure: Identified' : '',
        ].filter(Boolean),
        subtitle: 'Stack & Infrastructure',
      });
    }

    // ── 7. AI CAPABILITIES ────────────────────────────
    if (t.aiCapabilities.length > 0) {
      s.push({
        id: 'ai-cap', layout: 'table', sectionTag: 'AI CAPABILITIES',
        title: 'AI & Machine Learning Capabilities',
        table: {
          headers: ['Capability', 'Maturity', 'Confidence', 'Description'],
          rows: t.aiCapabilities.slice(0, 8).map(c => [
            c.capability, c.maturity.toUpperCase(), c.confidence,
            c.description.slice(0, 70) + (c.description.length > 70 ? '...' : ''),
          ]),
        },
      });
    }

    // ── 8. SECURITY OVERVIEW ──────────────────────────
    const riskLabel = sec.riskScore <= 30 ? 'LOW' : sec.riskScore <= 60 ? 'MODERATE' : 'ELEVATED';
    s.push({
      id: 'sec-overview', layout: 'keystat', sectionTag: 'SECURITY & RISK',
      title: 'Security Posture Assessment',
      stat: { value: `${sec.riskScore}/100`, label: `Overall Risk: ${riskLabel}` },
      bullets: [
        sec.complianceCertifications.length > 0
          ? `Certifications: ${sec.complianceCertifications.join(', ')}` : 'No certifications confirmed',
        `${sec.knownBreaches.length} known security incident(s)`,
        `${sec.regulatoryRisks.length} regulatory risk(s) identified`,
        `${sec.reputationRisks.length} reputation risk(s) flagged`,
        `${sec.supplyChainRisks.length} supply chain concern(s)`,
      ],
      accent: sec.riskScore <= 30 ? '#3fb950' : sec.riskScore <= 60 ? '#d29922' : '#f85149',
    });

    // ── 9. SECURITY DETAILS ───────────────────────────
    if (sec.regulatoryRisks.length > 0 || sec.reputationRisks.length > 0) {
      s.push({
        id: 'sec-risks', layout: 'twocol', sectionTag: 'RISK DETAIL',
        title: 'Regulatory & Reputation Risks',
        leftCol: sec.regulatoryRisks.slice(0, 4).map(r => r.slice(0, 120)),
        rightCol: sec.reputationRisks.slice(0, 4).map(r => r.slice(0, 120)),
        subtitle: 'Regulatory                         Reputation',
      });
    }

    // ── 10. COMPETITIVE ───────────────────────────────
    if (comp.competitors.length > 0) {
      s.push({
        id: 'comp-landscape', layout: 'table', sectionTag: 'COMPETITIVE INTELLIGENCE',
        title: 'Competitive Landscape',
        table: {
          headers: ['Competitor', 'Threat', 'Assessment'],
          rows: comp.competitors.slice(0, 7).map(c => [
            c.name, c.threatLevel, c.comparison.slice(0, 80) + (c.comparison.length > 80 ? '...' : ''),
          ]),
        },
      });
    }

    // ── 11. COMPETITIVE STRENGTHS/WEAKNESSES ──────────
    if (comp.differentiators.length > 0 || comp.weaknesses.length > 0) {
      s.push({
        id: 'comp-swot', layout: 'twocol', sectionTag: 'COMPETITIVE POSITION',
        title: 'Strengths & Vulnerabilities',
        leftCol: comp.differentiators.slice(0, 5).map(d => d.slice(0, 100)),
        rightCol: comp.weaknesses.slice(0, 5).map(w => w.slice(0, 100)),
        subtitle: 'Differentiators                    Vulnerabilities',
      });
    }

    // ── 12. RISK MATRIX ───────────────────────────────
    if (r.riskMatrix.length > 0) {
      s.push({
        id: 'risk-matrix', layout: 'table', sectionTag: 'RISK MATRIX',
        title: 'Consolidated Risk Assessment',
        table: {
          headers: ['Category', 'Risk', 'Likelihood', 'Impact', 'Score', 'Level'],
          rows: r.riskMatrix.map(rm => [
            rm.category, rm.riskName,
            `${rm.likelihood}/10`, `${rm.impact}/10`,
            String(rm.riskScore), rm.threatLevel,
          ]),
        },
      });
    }

    // ── 13-15. AI GOVERNANCE ──────────────────────────
    if (gov) {
      if (gov.aiUseCases.length > 0) {
        s.push({
          id: 'gov-usecases', layout: 'table', sectionTag: 'AI GOVERNANCE',
          title: 'AI Use Cases & Adoption Maturity',
          table: {
            headers: ['Use Case', 'Domain', 'Maturity', 'Description'],
            rows: gov.aiUseCases.slice(0, 8).map(uc => [
              uc.name, uc.domain, uc.maturity.toUpperCase(),
              uc.description.slice(0, 60) + (uc.description.length > 60 ? '...' : ''),
            ]),
          },
        });
      }

      if (gov.bestPractices.length > 0 || gov.governancePolicies) {
        s.push({
          id: 'gov-practices', layout: 'bullets', sectionTag: 'AI GOVERNANCE',
          title: 'AI Governance Best Practices',
          bullets: [
            ...gov.bestPractices.map(bp => `Standard: ${bp}`),
            ...(gov.operationalReadiness ? [gov.operationalReadiness.slice(0, 200)] : []),
          ].slice(0, 8),
        });
      }
    }

    // ── 16-19. AGENT FRAMEWORK ────────────────────────
    if (af && af.audit.steps.length > 0) {
      s.push({
        id: 'agent-overview', layout: 'section', sectionTag: 'AGENT FRAMEWORK',
        title: `Workflow Transformation: ${af.audit.workflowName}`,
        content: af.executiveSummary?.slice(0, 400) || `Applying the Harvard AGENT Framework to ${o.name}'s primary AI workflow.`,
        bullets: [
          `Trigger: ${af.audit.trigger}`,
          `${af.audit.steps.length} workflow steps mapped`,
          `Target outcome: ${af.gauge.expectedOutcome.slice(0, 120)}`,
        ],
      });

      // Audit + Gauge combined
      if (af.gauge.assessments.length > 0) {
        s.push({
          id: 'agent-gauge', layout: 'table', sectionTag: 'AUDIT & GAUGE',
          title: 'Workflow Assessment Scores',
          subtitle: 'Impact, Repeatability, and Complexity per step',
          table: {
            headers: ['Step', 'Impact', 'Repeat.', 'Complex.', 'Notes'],
            rows: af.gauge.assessments.slice(0, 7).map(a => [
              a.stepName.slice(0, 30),
              `${a.impactScore}/5`, `${a.repeatabilityScore}/5`, `${a.complexityScore}/5`,
              a.notes.slice(0, 50) + (a.notes.length > 50 ? '...' : ''),
            ]),
          },
        });
      }

      // Engineer Phase
      if (af.engineer.redesignMap.length > 0) {
        s.push({
          id: 'agent-engineer', layout: 'table', sectionTag: 'ENGINEER PHASE',
          title: 'Agent-First Workflow Redesign',
          subtitle: 'Which steps move to agents vs. stay human',
          table: {
            headers: ['Step', 'Agent', 'Human', 'Rationale'],
            rows: af.engineer.redesignMap.slice(0, 7).map(rm => [
              rm.stepName.slice(0, 25),
              rm.agentAction ? '●' : '○',
              rm.humanAction ? '●' : '○',
              rm.rationale.slice(0, 55) + (rm.rationale.length > 55 ? '...' : ''),
            ]),
          },
        });
      }

      // Challenges + Solutions
      if (af.engineer.challenges.length > 0) {
        s.push({
          id: 'agent-challenges', layout: 'table', sectionTag: 'CHALLENGES & SOLUTIONS',
          title: 'Current Challenges → Agent Solutions',
          table: {
            headers: ['Step', 'Challenge', 'Agent Solution'],
            rows: af.engineer.challenges.slice(0, 6).map(c => [
              c.stepName.slice(0, 20),
              c.challenge.slice(0, 55) + (c.challenge.length > 55 ? '...' : ''),
              c.agentSolution.slice(0, 55) + (c.agentSolution.length > 55 ? '...' : ''),
            ]),
          },
        });
      }

      // Navigate
      if (af.navigate.interactions.length > 0) {
        s.push({
          id: 'agent-navigate', layout: 'twocol', sectionTag: 'NAVIGATE PHASE',
          title: 'Human-Agent Collaboration Model',
          leftCol: af.navigate.interactions.slice(0, 4).map(i =>
            `${i.stepName}: ${i.humanRole.slice(0, 50)}`
          ),
          rightCol: af.navigate.interactions.slice(0, 4).map(i =>
            `${i.stepName}: ${i.agentRole.slice(0, 50)}`
          ),
          subtitle: 'Human Roles                        Agent Roles',
          bullets: [
            af.navigate.transparency ? `Transparency: ${af.navigate.transparency.slice(0, 100)}` : '',
            af.navigate.governance ? `Governance: ${af.navigate.governance.slice(0, 100)}` : '',
          ].filter(Boolean),
        });
      }

      // Track
      if (af.track.metrics.length > 0) {
        s.push({
          id: 'agent-track', layout: 'bullets', sectionTag: 'TRACK PHASE',
          title: 'Success Metrics & Measurement',
          subtitle: af.track.desiredOutcome?.slice(0, 150),
          bullets: [
            ...af.track.successSignals.slice(0, 3),
            '---',
            ...af.track.metrics.slice(0, 5),
          ],
        });
      }
    }

    // ── CLOSING ────────────────────────────────────────
    s.push({
      id: 'methodology', layout: 'bullets', sectionTag: 'METHODOLOGY',
      title: 'Research Methodology',
      bullets: [
        `5-agent swarm: Reconnaissance, Tech, Security, Competitive, Governance`,
        `Cost-optimized model routing across 3 Perplexity tiers`,
        `sonar ($1/1M) for factual lookups`,
        `sonar-reasoning-pro ($2/8M) for multi-step analysis`,
        `sonar-deep-research ($2/8M + reasoning) for exhaustive tech mapping`,
        `Claude for analytical synthesis and AGENT framework generation`,
        `Anti-slop writing filter (humanizer + stop-slop) applied to all output`,
        `${r.allSources.length} unique OSINT sources consulted`,
      ],
    });

    s.push({
      id: 'closing', layout: 'closing',
      title: o.name,
      subtitle: 'Intelligence Assessment Complete',
      content: [
        r.metadata.classification,
        `${r.allSources.length} sources · ${r.metadata.researchQueries} queries · ${(r.metadata.totalDurationMs / 1000).toFixed(0)}s`,
        r.metadata.generatedBy,
      ].join('\n'),
    });

    return s;
  }

  private extractBLUF(summary: string): { statement: string; keyFindings: string[] } {
    const lines = summary.split('\n').filter(l => l.trim().length > 0);
    let statement = '';
    const findings: string[] = [];

    for (const line of lines) {
      const clean = line.replace(/^[#*•\-\s]+/, '').trim();
      if (!statement && clean.length > 50 && !/^#|KEY FIND|RECOMMEND|RISK ASS/i.test(clean)) {
        statement = clean.slice(0, 350);
        continue;
      }
      if (/^\*\*/.test(line.trim()) && clean.length > 20) {
        findings.push(clean.replace(/\*\*/g, '').slice(0, 150));
      }
    }

    if (!statement) statement = lines[0]?.slice(0, 350) ?? '';
    return { statement, keyFindings: findings.slice(0, 6) };
  }

  private buildMetrics(r: AuditReport): Array<{ value: string; label: string }> {
    const metrics: Array<{ value: string; label: string }> = [];
    const o = r.orgIntelligence;

    if (o.revenue) metrics.push({ value: o.revenue, label: 'Revenue' });
    else if (o.employees) metrics.push({ value: o.employees, label: 'Employees' });
    else metrics.push({ value: String(r.allSources.length), label: 'Sources Analyzed' });

    metrics.push({ value: String(r.techIntelligence.aiCapabilities.length), label: 'AI Capabilities' });
    metrics.push({ value: `${r.securityRisk.riskScore}/100`, label: 'Risk Score' });
    metrics.push({ value: String(r.competitiveIntel.competitors.length), label: 'Competitors Mapped' });
    if (r.securityRisk.complianceCertifications.length > 0) {
      metrics.push({ value: String(r.securityRisk.complianceCertifications.length), label: 'Compliance Certs' });
    }
    if (r.aiGovernance?.aiUseCases.length) {
      metrics.push({ value: String(r.aiGovernance.aiUseCases.length), label: 'AI Use Cases' });
    }

    return metrics;
  }

  // ── HTML RENDERER ──────────────────────────────────

  private renderHTML(slides: Slide[], report: AuditReport): string {
    const org = report.orgIntelligence.name;
    const body = slides.map((s, i) => this.renderSlide(s, i, slides.length)).join('\n');

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ARGUS — ${this.esc(org)} Intelligence Assessment</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#09090b;--surface:#18181b;--surface2:#27272a;--border:#3f3f46;--text:#fafafa;--text2:#a1a1aa;--text3:#71717a;--blue:#3b82f6;--blue2:#60a5fa;--green:#22c55e;--amber:#f59e0b;--red:#ef4444;--purple:#a855f7}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-snap-type:y mandatory;scroll-behavior:smooth;font-size:16px}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}

.s{width:100vw;min-height:100vh;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:center;padding:7vh 8vw;position:relative;overflow:hidden}
.s::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--blue);opacity:0.6}

.s-cover{background:linear-gradient(160deg,#09090b 0%,#0f172a 40%,#1e1b4b 70%,#09090b 100%);text-align:center;align-items:center}
.s-cover h1{font-size:clamp(3rem,6vw,5rem);font-weight:800;letter-spacing:-0.04em;line-height:1.1;background:linear-gradient(135deg,#fff 0%,#60a5fa 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.s-cover .sub{font-size:clamp(1.1rem,2vw,1.6rem);color:var(--text2);margin-top:0.8em;font-weight:300;letter-spacing:0.02em}
.s-cover .meta{font-size:0.8rem;color:var(--text3);margin-top:2em;font-family:monospace;letter-spacing:0.05em}
.s-cover .footer{position:absolute;bottom:4vh;font-size:0.7rem;color:var(--text3);font-family:monospace}

.s-closing{background:linear-gradient(160deg,#09090b 0%,#0f172a 40%,#1e1b4b 70%,#09090b 100%);text-align:center;align-items:center}
.s-closing h1{font-size:clamp(2.5rem,5vw,4rem);font-weight:800;letter-spacing:-0.03em;color:var(--text)}
.s-closing .sub{font-size:1.2rem;color:var(--text2);margin-top:0.6em;font-weight:300}
.s-closing .meta{font-size:0.75rem;color:var(--text3);margin-top:2em;font-family:monospace;white-space:pre-line}

.tag{display:inline-block;font-size:0.65rem;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--blue2);padding:0.3em 0.8em;border:1px solid var(--blue);border-radius:3px;margin-bottom:1.2em;font-family:monospace}
h2{font-size:clamp(1.6rem,3vw,2.4rem);font-weight:700;letter-spacing:-0.02em;color:var(--text);margin-bottom:0.3em;line-height:1.2}
.sub2{font-size:0.95rem;color:var(--text3);margin-bottom:1.5em;font-weight:400}

.stat-hero{font-size:clamp(3rem,7vw,6rem);font-weight:800;letter-spacing:-0.04em;line-height:1;margin:0.3em 0}
.stat-label{font-size:1rem;color:var(--text2);font-weight:400;text-transform:uppercase;letter-spacing:0.08em}

.content-p{font-size:clamp(0.95rem,1.3vw,1.15rem);line-height:1.75;color:var(--text2);max-width:52em}

ul.bl{list-style:none;padding:0;max-width:52em}
ul.bl li{padding:0.55em 0 0.55em 1.4em;position:relative;font-size:clamp(0.9rem,1.2vw,1.05rem);line-height:1.6;color:var(--text2)}
ul.bl li::before{content:'';position:absolute;left:0;top:1em;width:6px;height:6px;border-radius:50%;background:var(--blue)}
ul.bl li.sep{border:none;padding:0.3em 0;pointer-events:none}
ul.bl li.sep::before{display:none}

.cols{display:grid;grid-template-columns:1fr 1fr;gap:4vw;margin-top:0.5em}
.col-head{font-size:0.7rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:var(--blue2);margin-bottom:0.8em;padding-bottom:0.4em;border-bottom:1px solid var(--border)}

table{width:100%;border-collapse:collapse;margin:0.5em 0;font-size:clamp(0.8rem,1vw,0.95rem)}
th{text-align:left;padding:0.7em 0.9em;color:var(--blue2);font-weight:600;font-size:0.75rem;letter-spacing:0.08em;text-transform:uppercase;border-bottom:2px solid var(--border);background:var(--surface)}
td{padding:0.65em 0.9em;border-bottom:1px solid var(--surface2);color:var(--text2)}
tr:hover td{background:var(--surface)}
td:first-child{color:var(--text);font-weight:500}

.badge{display:inline-block;font-size:0.7rem;font-weight:600;padding:0.15em 0.5em;border-radius:3px;letter-spacing:0.03em}
.badge-high{background:rgba(239,68,68,0.15);color:var(--red)}
.badge-med{background:rgba(245,158,11,0.15);color:var(--amber)}
.badge-low{background:rgba(34,197,94,0.15);color:var(--green)}
.badge-prod{background:rgba(59,130,246,0.15);color:var(--blue2)}
.badge-dev{background:rgba(168,85,247,0.15);color:var(--purple)}

.snum{position:absolute;bottom:3vh;right:4vw;font-size:0.7rem;color:var(--text3);font-family:monospace}

@media(max-width:768px){.cols{grid-template-columns:1fr}h2{font-size:1.6rem}.s{padding:5vh 6vw}}
@media print{.s{page-break-after:always;min-height:auto;padding:1.5cm}}
</style></head><body>
${body}
<script>
const S=document.querySelectorAll('.s');
document.addEventListener('keydown',e=>{
if(e.key==='ArrowDown'||e.key===' '||e.key==='ArrowRight'){e.preventDefault();window.scrollBy({top:innerHeight,behavior:'smooth'})}
if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();window.scrollBy({top:-innerHeight,behavior:'smooth'})}
});
</script></body></html>`;
  }

  private renderSlide(s: Slide, idx: number, total: number): string {
    const num = `<div class="snum">${idx + 1} / ${total}</div>`;

    if (s.layout === 'cover') {
      return `<div class="s s-cover" id="${s.id}">
<h1>${this.esc(s.title)}</h1>
<div class="sub">${this.esc(s.subtitle ?? '')}</div>
<div class="meta">${this.esc(s.content ?? '')}</div>
${s.footer ? `<div class="footer">${this.esc(s.footer)}</div>` : ''}
${num}</div>`;
    }

    if (s.layout === 'closing') {
      return `<div class="s s-closing" id="${s.id}">
<h1>${this.esc(s.title)}</h1>
<div class="sub">${this.esc(s.subtitle ?? '')}</div>
<div class="meta">${this.esc(s.content ?? '')}</div>
${num}</div>`;
    }

    let html = `<div class="s" id="${s.id}"${s.accent ? ` style="--blue:${s.accent};--blue2:${s.accent}"` : ''}>`;
    if (s.sectionTag) html += `<span class="tag">${this.esc(s.sectionTag)}</span>`;
    html += `<h2>${this.esc(s.title)}</h2>`;
    if (s.subtitle) html += `<div class="sub2">${this.esc(s.subtitle)}</div>`;

    if (s.layout === 'keystat' && s.stat) {
      html += `<div class="stat-hero">${this.esc(s.stat.value)}</div>`;
      html += `<div class="stat-label">${this.esc(s.stat.label)}</div>`;
    }

    if (s.layout === 'section' && s.content) {
      html += `<p class="content-p">${this.esc(s.content)}</p>`;
    }

    if (s.bullets) {
      html += '<ul class="bl">';
      for (const b of s.bullets) {
        if (b === '---') { html += '<li class="sep"></li>'; continue; }
        html += `<li>${this.esc(b)}</li>`;
      }
      html += '</ul>';
    }

    if (s.table) {
      html += '<table><thead><tr>';
      for (const h of s.table.headers) html += `<th>${this.esc(h)}</th>`;
      html += '</tr></thead><tbody>';
      for (const row of s.table.rows) {
        html += '<tr>';
        for (let ci = 0; ci < row.length; ci++) {
          const cell = row[ci];
          const badged = this.maybeBadge(cell, s.table.headers[ci]);
          html += `<td>${badged}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
    }

    if (s.layout === 'twocol') {
      const lTitle = s.subtitle?.split(/\s{3,}/)?.[0] ?? 'Column A';
      const rTitle = s.subtitle?.split(/\s{3,}/)?.[1] ?? 'Column B';
      html += '<div class="cols"><div>';
      html += `<div class="col-head">${this.esc(lTitle)}</div>`;
      html += '<ul class="bl">';
      for (const b of (s.leftCol ?? [])) html += `<li>${this.esc(b)}</li>`;
      html += '</ul></div><div>';
      html += `<div class="col-head">${this.esc(rTitle)}</div>`;
      html += '<ul class="bl">';
      for (const b of (s.rightCol ?? [])) html += `<li>${this.esc(b)}</li>`;
      html += '</ul></div></div>';

      if (s.bullets) {
        html += '<ul class="bl" style="margin-top:1.5em">';
        for (const b of s.bullets) html += `<li>${this.esc(b)}</li>`;
        html += '</ul>';
      }
    }

    html += num + '</div>';
    return html;
  }

  private maybeBadge(cell: string, header: string): string {
    const h = header.toLowerCase();
    const c = cell.toUpperCase();
    if (h.includes('threat') || h.includes('level') || h.includes('confidence')) {
      if (c === 'HIGH' || c === 'CRITICAL') return `<span class="badge badge-high">${this.esc(cell)}</span>`;
      if (c === 'MEDIUM' || c === 'MODERATE') return `<span class="badge badge-med">${this.esc(cell)}</span>`;
      if (c === 'LOW' || c === 'INFO') return `<span class="badge badge-low">${this.esc(cell)}</span>`;
    }
    if (h.includes('maturity')) {
      if (c === 'PRODUCTION' || c === 'ENTERPRISE') return `<span class="badge badge-prod">${this.esc(cell)}</span>`;
      if (c === 'DEVELOPMENT' || c === 'RESEARCH') return `<span class="badge badge-dev">${this.esc(cell)}</span>`;
      if (c === 'SCALING' || c === 'OPTIMIZING') return `<span class="badge badge-prod">${this.esc(cell)}</span>`;
      if (c === 'PILOTING' || c === 'EXPLORING') return `<span class="badge badge-med">${this.esc(cell)}</span>`;
    }
    if (cell === '●') return '<span style="color:var(--green);font-size:1.2em">●</span>';
    if (cell === '○') return '<span style="color:var(--text3)">○</span>';
    return this.esc(cell);
  }

  private esc(t: string): string {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

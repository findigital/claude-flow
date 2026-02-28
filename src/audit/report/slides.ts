/**
 * ARGUS Slide Presentation Generator
 *
 * Generates a standalone HTML slide deck from the audit report.
 * Uses a lightweight CSS-only slide system (no external dependencies).
 * Compatible with frontend-slides JSON export format.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { AuditReport } from '../types.js';

interface SlideData {
  title: string;
  subtitle?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  content?: string;
  type: 'title' | 'content' | 'table' | 'section' | 'summary';
}

export class SlideGenerator {
  generate(report: AuditReport, outputDir: string): string {
    mkdirSync(outputDir, { recursive: true });

    const slides = this.buildSlides(report);
    const html = this.renderHTML(slides, report);

    const filename = `ARGUS-${report.metadata.targetOrg.replace(/\W+/g, '-')}-Slides.html`;
    const outputPath = join(outputDir, filename);
    writeFileSync(outputPath, html, 'utf-8');

    const jsonFilename = `ARGUS-${report.metadata.targetOrg.replace(/\W+/g, '-')}-Slides.json`;
    const jsonPath = join(outputDir, jsonFilename);
    writeFileSync(jsonPath, JSON.stringify({ slides, metadata: report.metadata }, null, 2), 'utf-8');

    return outputPath;
  }

  private buildSlides(r: AuditReport): SlideData[] {
    const slides: SlideData[] = [];

    slides.push({
      type: 'title',
      title: `Organizational Intelligence Assessment`,
      subtitle: `${r.orgIntelligence.name} — ${new Date(r.metadata.generatedAt).toLocaleDateString()}`,
      content: `Report ${r.metadata.reportId} | ${r.metadata.classification} | ${r.allSources.length} sources`,
    });

    slides.push({
      type: 'section',
      title: 'Executive Summary',
      content: this.truncate(r.executiveSummary, 600),
    });

    slides.push({
      type: 'table',
      title: 'Organization Profile',
      table: {
        headers: ['Attribute', 'Intelligence'],
        rows: [
          ['Industry', r.orgIntelligence.industry || 'See report'],
          ['Founded', r.orgIntelligence.founded || 'See report'],
          ['Headquarters', r.orgIntelligence.headquarters || 'See report'],
          ['CEO', r.orgIntelligence.ceo || 'See report'],
          ['Employees', r.orgIntelligence.employees || 'See report'],
          ['Revenue', r.orgIntelligence.revenue || 'See report'],
          ['Status', r.orgIntelligence.publicOrPrivate || 'See report'],
        ].filter(row => row[1] !== 'See report').slice(0, 7),
      },
    });

    if (r.techIntelligence.aiCapabilities.length > 0) {
      slides.push({
        type: 'table',
        title: 'AI Capabilities Detected',
        table: {
          headers: ['Capability', 'Maturity', 'Confidence'],
          rows: r.techIntelligence.aiCapabilities.slice(0, 8).map(c => [
            c.capability, c.maturity, c.confidence,
          ]),
        },
      });
    }

    if (r.techIntelligence.techStack.length > 0) {
      slides.push({
        type: 'content',
        title: 'Technology Stack',
        bullets: r.techIntelligence.techStack.map(s =>
          `${s.category}: ${s.technologies.slice(0, 5).join(', ')}`
        ),
      });
    }

    const riskEmoji = r.securityRisk.riskScore <= 30 ? 'LOW' : r.securityRisk.riskScore <= 60 ? 'MEDIUM' : 'HIGH';
    slides.push({
      type: 'content',
      title: `Security & Risk — Score: ${r.securityRisk.riskScore}/100 (${riskEmoji})`,
      bullets: [
        ...(r.securityRisk.complianceCertifications.length > 0
          ? [`Certifications: ${r.securityRisk.complianceCertifications.join(', ')}`] : []),
        `Known breaches: ${r.securityRisk.knownBreaches.length}`,
        `Regulatory risks: ${r.securityRisk.regulatoryRisks.length} identified`,
        `Reputation risks: ${r.securityRisk.reputationRisks.length} identified`,
      ],
    });

    if (r.competitiveIntel.competitors.length > 0) {
      slides.push({
        type: 'table',
        title: 'Competitive Landscape',
        table: {
          headers: ['Competitor', 'Threat Level'],
          rows: r.competitiveIntel.competitors.slice(0, 8).map(c => [
            c.name, c.threatLevel,
          ]),
        },
      });
    }

    if (r.riskMatrix.length > 0) {
      slides.push({
        type: 'table',
        title: 'Risk Matrix',
        table: {
          headers: ['Category', 'Risk', 'Score', 'Level'],
          rows: r.riskMatrix.slice(0, 6).map(rm => [
            rm.category, rm.riskName, String(rm.riskScore), rm.threatLevel,
          ]),
        },
      });
    }

    // AI Governance slides
    if (r.aiGovernance) {
      const gov = r.aiGovernance;

      if (gov.aiUseCases.length > 0) {
        slides.push({
          type: 'table',
          title: 'AI Use Cases & Adoption',
          table: {
            headers: ['Use Case', 'Domain', 'Maturity'],
            rows: gov.aiUseCases.slice(0, 8).map(uc => [uc.name, uc.domain, uc.maturity]),
          },
        });
      }

      if (gov.bestPractices.length > 0) {
        slides.push({
          type: 'content',
          title: 'AI Governance & Best Practices',
          bullets: [
            ...gov.bestPractices.map(bp => `Follows: ${bp}`),
            ...(gov.governancePolicies ? [gov.governancePolicies.slice(0, 200)] : []),
          ],
        });
      }

      const af = gov.agentFramework;
      if (af.audit.steps.length > 0) {
        slides.push({
          type: 'content',
          title: `AGENT Framework: ${af.audit.workflowName}`,
          bullets: [
            `Trigger: ${af.audit.trigger}`,
            `Steps: ${af.audit.steps.length}`,
            `Outcome: ${af.gauge.expectedOutcome.slice(0, 150)}`,
            `Final output: ${af.audit.finalOutput.slice(0, 150)}`,
          ],
        });

        if (af.engineer.redesignMap.length > 0) {
          slides.push({
            type: 'table',
            title: 'AGENT: Engineer Phase — Redesign Map',
            table: {
              headers: ['Step', 'Agent?', 'Human?', 'Rationale'],
              rows: af.engineer.redesignMap.slice(0, 7).map(r => [
                r.stepName, r.agentAction ? 'Yes' : 'No', r.humanAction ? 'Yes' : 'No',
                r.rationale.slice(0, 60),
              ]),
            },
          });
        }

        if (af.track.metrics.length > 0) {
          slides.push({
            type: 'content',
            title: 'AGENT: Track Phase — Success Metrics',
            bullets: af.track.metrics.slice(0, 8),
          });
        }
      }
    }

    slides.push({
      type: 'summary',
      title: 'Methodology & Sources',
      bullets: [
        `Agents deployed: ${r.metadata.agentCount}`,
        `Research queries: ${r.metadata.researchQueries}`,
        `Sources collected: ${r.allSources.length}`,
        `Duration: ${(r.metadata.totalDurationMs / 1000).toFixed(0)}s`,
        'Models: sonar (facts), sonar-reasoning-pro (analysis), sonar-deep-research (tech deep dive)',
        'All findings derived from publicly available OSINT',
      ],
    });

    return slides;
  }

  private renderHTML(slides: SlideData[], report: AuditReport): string {
    const slideHTML = slides.map((s, i) => this.renderSlide(s, i)).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ARGUS — ${report.orgIntelligence.name} Intelligence Assessment</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e0e0e0; }
  .slide { width: 100vw; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 6vh 8vw; scroll-snap-align: start; border-bottom: 1px solid #222; }
  .slide-title { width: 100vw; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 8vh 10vw; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%); }
  .slide-section { background: linear-gradient(135deg, #0d1117 0%, #161b22 100%); }
  h1 { font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 700; margin-bottom: 0.5em; color: #fff; letter-spacing: -0.02em; }
  h2 { font-size: clamp(1.5rem, 3vw, 2.5rem); font-weight: 600; margin-bottom: 0.8em; color: #58a6ff; }
  .subtitle { font-size: clamp(1rem, 2vw, 1.5rem); color: #8b949e; margin-top: 0.5em; }
  .meta { font-size: 0.85rem; color: #484f58; margin-top: 1em; font-family: monospace; }
  ul { list-style: none; padding-left: 0; }
  ul li { padding: 0.6em 0; padding-left: 1.5em; position: relative; font-size: clamp(0.95rem, 1.5vw, 1.2rem); line-height: 1.5; }
  ul li::before { content: '\\25B8'; position: absolute; left: 0; color: #58a6ff; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  th { text-align: left; padding: 0.8em 1em; background: #161b22; color: #58a6ff; font-weight: 600; border-bottom: 2px solid #30363d; font-size: 0.9rem; }
  td { padding: 0.7em 1em; border-bottom: 1px solid #21262d; font-size: 0.9rem; }
  tr:hover td { background: #161b22; }
  .content-text { font-size: clamp(0.9rem, 1.3vw, 1.1rem); line-height: 1.7; color: #c9d1d9; max-width: 900px; }
  .slide-number { position: fixed; bottom: 2vh; right: 3vw; font-size: 0.8rem; color: #484f58; font-family: monospace; }
  .classification { font-size: 0.75rem; color: #f85149; font-family: monospace; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 2em; }
  html { scroll-snap-type: y mandatory; scroll-behavior: smooth; }
  @media print { .slide { page-break-after: always; min-height: auto; padding: 2cm; } }
</style>
</head>
<body>
${slideHTML}
<div class="slide-number" id="slideNum">1 / ${slides.length}</div>
<script>
const slides = document.querySelectorAll('.slide, .slide-title');
const counter = document.getElementById('slideNum');
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const idx = Array.from(slides).indexOf(e.target) + 1;
      counter.textContent = idx + ' / ' + slides.length;
    }
  });
}, { threshold: 0.5 });
slides.forEach(s => observer.observe(s));
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'ArrowRight') {
    e.preventDefault(); window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    e.preventDefault(); window.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
  }
});
</script>
</body>
</html>`;
  }

  private renderSlide(slide: SlideData, index: number): string {
    const cls = slide.type === 'title' ? 'slide-title' : slide.type === 'section' ? 'slide slide-section' : 'slide';

    let inner = '';

    if (slide.type === 'title') {
      inner = `<div class="classification">${slide.content ?? 'UNCLASSIFIED'}</div>
<h1>${this.esc(slide.title)}</h1>
<div class="subtitle">${this.esc(slide.subtitle ?? '')}</div>`;
    } else {
      inner = `<h2>${this.esc(slide.title)}</h2>`;

      if (slide.content && slide.type === 'section') {
        inner += `<div class="content-text">${this.esc(slide.content).replace(/\n/g, '<br>')}</div>`;
      }

      if (slide.bullets) {
        inner += '<ul>' + slide.bullets.map(b => `<li>${this.esc(b)}</li>`).join('') + '</ul>';
      }

      if (slide.table) {
        const t = slide.table;
        inner += '<table><thead><tr>' + t.headers.map(h => `<th>${this.esc(h)}</th>`).join('') + '</tr></thead><tbody>';
        for (const row of t.rows) {
          inner += '<tr>' + row.map(cell => `<td>${this.esc(cell)}</td>`).join('') + '</tr>';
        }
        inner += '</tbody></table>';
      }
    }

    return `<div class="${cls}" id="slide-${index}">\n${inner}\n</div>`;
  }

  private truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.slice(0, max).replace(/\s+\S*$/, '') + '...';
  }

  private esc(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

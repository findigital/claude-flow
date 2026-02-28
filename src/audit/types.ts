/**
 * ARGUS — Agent-based Research & Governance Unified Scanner
 * Palantir-Style Organizational AI Audit System
 *
 * Core type definitions for web-research-based intelligence gathering.
 */

export interface AuditConfig {
  targetUrl: string;
  orgName: string;
  depth: 'quick' | 'standard' | 'deep';
  outputDir: string;
  enableClaude: boolean;
  perplexityModel: string;
}

export type ClassificationLevel = 'UNCLASSIFIED' | 'CUI' | 'CONFIDENTIAL';
export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type ConfidenceLevel = 'CONFIRMED' | 'HIGH' | 'MODERATE' | 'LOW' | 'UNVERIFIED';

export interface ResearchResult {
  query: string;
  content: string;
  citations: string[];
  model: string;
  timestamp: string;
}

export interface AgentResult<T> {
  agentId: string;
  agentType: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: 'success' | 'partial' | 'error';
  data: T;
  sources: string[];
  errors: string[];
}

// ─── Reconnaissance ─────────────────────────────────────────────

export interface OrgIntelligence {
  name: string;
  website: string;
  overview: string;
  founded: string;
  headquarters: string;
  ceo: string;
  employees: string;
  revenue: string;
  industry: string;
  publicOrPrivate: string;
  stockTicker: string;
  mission: string;
  keyProducts: string[];
  recentNews: string[];
  sources: string[];
}

// ─── Technology Intelligence ────────────────────────────────────

export interface TechIntelligence {
  techStack: TechStackEntry[];
  aiCapabilities: AICapabilityEntry[];
  patents: PatentEntry[];
  engineeringCulture: string;
  openSourcePresence: string;
  cloudInfrastructure: string;
  dataStrategy: string;
  techBlogHighlights: string[];
  sources: string[];
}

export interface TechStackEntry {
  category: string;
  technologies: string[];
  confidence: ConfidenceLevel;
  evidence: string;
}

export interface AICapabilityEntry {
  capability: string;
  description: string;
  maturity: 'research' | 'development' | 'production' | 'enterprise';
  products: string[];
  confidence: ConfidenceLevel;
}

export interface PatentEntry {
  title: string;
  area: string;
  year: string;
  relevance: string;
}

// ─── Security & Risk ────────────────────────────────────────────

export interface SecurityRiskIntelligence {
  overallPosture: string;
  riskScore: number;
  knownBreaches: BreachEntry[];
  complianceCertifications: string[];
  privacyPolicySummary: string;
  dataHandlingPractices: string;
  securityIncidents: string[];
  regulatoryRisks: string[];
  reputationRisks: string[];
  supplyChainRisks: string[];
  sources: string[];
}

export interface BreachEntry {
  date: string;
  description: string;
  impact: string;
  resolution: string;
}

// ─── Competitive Intelligence ───────────────────────────────────

export interface CompetitiveIntelligence {
  marketPosition: string;
  marketShare: string;
  competitors: CompetitorEntry[];
  differentiators: string[];
  weaknesses: string[];
  partnerships: PartnershipEntry[];
  acquisitions: string[];
  fundingHistory: string;
  growthTrajectory: string;
  sources: string[];
}

export interface CompetitorEntry {
  name: string;
  comparison: string;
  threatLevel: ThreatLevel;
}

export interface PartnershipEntry {
  partner: string;
  nature: string;
  significance: string;
}

// ─── Risk Matrix ────────────────────────────────────────────────

export interface RiskMatrixEntry {
  category: string;
  riskName: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  threatLevel: ThreatLevel;
  description: string;
  mitigations: string[];
}

// ─── Strategic Recommendations ──────────────────────────────────

export interface StrategicRecommendation {
  priority: 'IMMEDIATE' | 'SHORT-TERM' | 'MEDIUM-TERM' | 'LONG-TERM';
  category: string;
  title: string;
  description: string;
  rationale: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
}

// ─── Full Audit Report ──────────────────────────────────────────

export interface AuditReport {
  metadata: AuditMetadata;
  executiveSummary: string;
  orgIntelligence: OrgIntelligence;
  techIntelligence: TechIntelligence;
  securityRisk: SecurityRiskIntelligence;
  competitiveIntel: CompetitiveIntelligence;
  riskMatrix: RiskMatrixEntry[];
  strategicRecommendations: StrategicRecommendation[];
  methodology: string;
  allSources: string[];
}

export interface AuditMetadata {
  reportId: string;
  classification: ClassificationLevel;
  generatedAt: string;
  generatedBy: string;
  targetOrg: string;
  targetUrl: string;
  auditDepth: string;
  totalDurationMs: number;
  agentCount: number;
  researchQueries: number;
  version: string;
}

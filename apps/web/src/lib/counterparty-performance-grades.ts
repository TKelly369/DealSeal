/**
 * DealSeal “clean deal” and partner proficiency grades — derived from pipeline health,
 * document jacket signals, volume, and cycle-time proxies. Explanatory copy on pages ties
 * scores to lender/dealer selection by state and credit market.
 */

export type GradeLetter = "A" | "B" | "C" | "D";

export type MarketSegment = "PRIME" | "SUBPRIME" | "UNKNOWN";

export type DealerPerformanceSignals = {
  dealerId: string;
  dealerName: string;
  /** Primary geography for ranking (deal state mode or profile). */
  primaryState: string;
  operatingStates: string[];
  dealCount: number;
  consummatedCount: number;
  openPipelineCount: number;
  blockedComplianceCount: number;
  openCriticalAlerts: number;
  openWarningAlerts: number;
  totalAmendments: number;
  /** Consummated deals with a strong jacket proxy (key doc types present). */
  jacketCompleteConsummated: number;
  /** Sum of hours from created → last update for consummated deals (for average). */
  consummatedCycleHoursSum: number;
  /** Post-funding stipulation alerts still open on consummated deals. */
  postFundingStipOpenCount: number;
  /** Count of post-funding stip alerts that were cured (cleared/overridden). */
  postFundingStipResolvedCount: number;
  /** Sum of hours to cure post-funding stip alerts. */
  postFundingStipCureHoursSum: number;
};

export type LenderPerformanceSignals = {
  lenderId: string;
  lenderName: string;
  licensedStates: string[];
  dealCount: number;
  consummatedCount: number;
  openPipelineCount: number;
  blockedComplianceCount: number;
  openCriticalAlerts: number;
  openWarningAlerts: number;
  totalAmendments: number;
  jacketCompleteConsummated: number;
  consummatedCycleHoursSum: number;
  postFundingStipOpenCount: number;
  postFundingStipResolvedCount: number;
  postFundingStipCureHoursSum: number;
  /** Deals in segment (by buyer credit tier / amount proxy). */
  segment: MarketSegment;
  segmentDealCount: number;
};

export type GradedDealerForLender = DealerPerformanceSignals & {
  problemFreeScore: number;
  jacketScore: number;
  volumeScore: number;
  cycleScore: number;
  secondGreenScore: number;
  overallScore: number;
  grade: GradeLetter;
  preferredTier: "preferred" | "standard" | "watch";
};

export type GradedLenderSegment = LenderPerformanceSignals & {
  problemFreeScore: number;
  fileManagementScore: number;
  dealsClosedScore: number;
  jacketScore: number;
  volumeScore: number;
  cycleScore: number;
  secondGreenScore: number;
  overallScore: number;
  grade: GradeLetter;
  proficiencyTier: "lead" | "capable" | "developing";
};

export type GradedLenderForDealer = {
  lenderId: string;
  lenderName: string;
  licensedStates: string[];
  bySegment: GradedLenderSegment[];
};

const JACKET_DOC_TYPES = new Set([
  "INITIAL_DISCLOSURE_SIGNED",
  "RISC_SIGNED",
  "RISC_LENDER_FINAL",
  "UCSP_CLOSING_MANIFEST",
]);

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function letterFromScore(score: number): GradeLetter {
  if (score >= 88) return "A";
  if (score >= 74) return "B";
  if (score >= 60) return "C";
  return "D";
}

function preferredTier(overall: number, problemFree: number): GradedDealerForLender["preferredTier"] {
  if (overall >= 82 && problemFree >= 80) return "preferred";
  if (overall >= 65 && problemFree >= 60) return "standard";
  return "watch";
}

function proficiencyTier(overall: number): "lead" | "capable" | "developing" {
  if (overall >= 80) return "lead";
  if (overall >= 65) return "capable";
  return "developing";
}

/** Fewer open problems + fewer amendments per deal → higher score. */
export function problemFreeScore(s: {
  dealCount: number;
  openPipelineCount: number;
  blockedComplianceCount: number;
  openCriticalAlerts: number;
  openWarningAlerts: number;
  totalAmendments: number;
}): number {
  if (s.dealCount === 0) return 70;
  const amendRate = s.totalAmendments / s.dealCount;
  const blockRate = s.openPipelineCount > 0 ? s.blockedComplianceCount / s.openPipelineCount : 0;
  const critPerDeal = s.openCriticalAlerts / s.dealCount;
  const warnPerDeal = s.openWarningAlerts / Math.max(1, s.dealCount);
  let score = 100;
  score -= clamp(critPerDeal * 35, 0, 45);
  score -= clamp(warnPerDeal * 12, 0, 25);
  score -= clamp(blockRate * 30, 0, 35);
  score -= clamp(amendRate * 18, 0, 40);
  return clamp(Math.round(score), 0, 100);
}

/** Share of consummated deals with a complete “jacket” proxy. */
export function jacketCompletenessScore(consummated: number, jacketComplete: number): number {
  if (consummated === 0) return 72;
  return clamp(Math.round((jacketComplete / consummated) * 100), 0, 100);
}

/** Volume vs participation — rewards meaningful flow without punishing small shops harshly. */
export function volumeScore(dealCount: number, consummated: number): number {
  if (dealCount === 0) return 50;
  const completionRatio = consummated / dealCount;
  const flow = Math.log10(1 + dealCount) * 28;
  const done = completionRatio * 45;
  return clamp(Math.round(flow + done), 0, 100);
}

/** Faster consummation (median proxy) → higher score; cap at sensible SLA. */
export function cycleTimeScore(consummated: number, cycleHoursSum: number): number {
  if (consummated === 0) return 75;
  const avgHours = cycleHoursSum / consummated;
  const avgDays = avgHours / 24;
  if (avgDays <= 7) return 100;
  if (avgDays <= 14) return 90;
  if (avgDays <= 21) return 78;
  if (avgDays <= 35) return 65;
  return clamp(Math.round(55 - (avgDays - 35) * 2), 20, 65);
}

/**
 * "Second green light": after funding/consummation, stipulations should be cured quickly.
 * Open post-funding stips and slow cure times both reduce score.
 */
export function secondGreenScore(s: {
  consummatedCount: number;
  postFundingStipOpenCount: number;
  postFundingStipResolvedCount: number;
  postFundingStipCureHoursSum: number;
}): number {
  if (s.consummatedCount === 0) return 80;
  const openRate = s.postFundingStipOpenCount / s.consummatedCount;
  const avgCureHours =
    s.postFundingStipResolvedCount > 0 ? s.postFundingStipCureHoursSum / s.postFundingStipResolvedCount : 0;
  const avgCureDays = avgCureHours / 24;
  let score = 100;
  score -= clamp(openRate * 55, 0, 60);
  if (s.postFundingStipResolvedCount > 0) {
    if (avgCureDays <= 2) score -= 0;
    else if (avgCureDays <= 5) score -= 8;
    else if (avgCureDays <= 10) score -= 18;
    else if (avgCureDays <= 20) score -= 32;
    else score -= 45;
  }
  return clamp(Math.round(score), 0, 100);
}

/** Lender file management quality: complete jackets plus post-funding stip cure discipline. */
export function fileManagementScore(s: {
  consummatedCount: number;
  jacketCompleteConsummated: number;
  postFundingStipOpenCount: number;
  postFundingStipResolvedCount: number;
  postFundingStipCureHoursSum: number;
}): number {
  const jacket = jacketCompletenessScore(s.consummatedCount, s.jacketCompleteConsummated);
  const secondGreen = secondGreenScore(s);
  return clamp(Math.round(jacket * 0.6 + secondGreen * 0.4), 0, 100);
}

/** Lender closure performance: emphasizes completed deals and timeliness. */
export function dealsClosedScore(s: {
  dealCount: number;
  consummatedCount: number;
  consummatedCycleHoursSum: number;
}): number {
  const closeRate = s.dealCount > 0 ? s.consummatedCount / s.dealCount : 0;
  const closeRateScore = clamp(Math.round(closeRate * 100), 0, 100);
  const cycle = cycleTimeScore(s.consummatedCount, s.consummatedCycleHoursSum);
  return clamp(Math.round(closeRateScore * 0.65 + cycle * 0.35), 0, 100);
}

export function gradeDealerForLender(s: DealerPerformanceSignals): GradedDealerForLender {
  const p = problemFreeScore(s);
  const j = jacketCompletenessScore(s.consummatedCount, s.jacketCompleteConsummated);
  const v = volumeScore(s.dealCount, s.consummatedCount);
  const c = cycleTimeScore(s.consummatedCount, s.consummatedCycleHoursSum);
  const sg = secondGreenScore(s);
  const overall = Math.round(p * 0.32 + sg * 0.22 + j * 0.18 + v * 0.16 + c * 0.12);
  const grade = letterFromScore(overall);
  return {
    ...s,
    problemFreeScore: p,
    jacketScore: j,
    volumeScore: v,
    cycleScore: c,
    secondGreenScore: sg,
    overallScore: overall,
    grade,
    preferredTier: preferredTier(overall, p),
  };
}

export function gradeLenderSegment(s: LenderPerformanceSignals): LenderPerformanceSignals & {
  problemFreeScore: number;
  fileManagementScore: number;
  dealsClosedScore: number;
  jacketScore: number;
  volumeScore: number;
  cycleScore: number;
  secondGreenScore: number;
  overallScore: number;
  grade: GradeLetter;
  proficiencyTier: "lead" | "capable" | "developing";
} {
  const p = problemFreeScore(s);
  const fm = fileManagementScore(s);
  const dc = dealsClosedScore(s);
  const j = jacketCompletenessScore(s.consummatedCount, s.jacketCompleteConsummated);
  const v = volumeScore(s.dealCount, s.consummatedCount);
  const c = cycleTimeScore(s.consummatedCount, s.consummatedCycleHoursSum);
  const sg = secondGreenScore(s);
  const overall = Math.round(fm * 0.45 + dc * 0.35 + p * 0.2);
  return {
    ...s,
    problemFreeScore: p,
    fileManagementScore: fm,
    dealsClosedScore: dc,
    jacketScore: j,
    volumeScore: v,
    cycleScore: c,
    secondGreenScore: sg,
    overallScore: overall,
    grade: letterFromScore(overall),
    proficiencyTier: proficiencyTier(overall),
  };
}

export function classifyCreditTier(creditTier: string | null | undefined, amountFinanced: number | null): MarketSegment {
  const t = (creditTier ?? "").toLowerCase();
  if (/sub|deep|non.?prime|tier\s*[34]|d\s*&\s*e/i.test(t)) return "SUBPRIME";
  if (/prime|tier\s*1|tier\s*2|super/i.test(t)) return "PRIME";
  if (amountFinanced != null) {
    const n = Number(amountFinanced);
    if (n > 0 && n < 18_000) return "SUBPRIME";
    if (n >= 28_000) return "PRIME";
  }
  return "UNKNOWN";
}

export function isJacketCompleteForDeal(docTypes: (string | null)[]): boolean {
  const set = new Set(docTypes.filter(Boolean) as string[]);
  let hit = 0;
  for (const d of JACKET_DOC_TYPES) {
    if (set.has(d)) hit++;
  }
  return hit >= 3;
}

export { JACKET_DOC_TYPES };

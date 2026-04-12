import type { Session, UserProfile, DailyMetrics, RollingMetrics } from "@/models/types";

// ── TRIMP (Banister 1991) ──────────────────────────────────────
// TRIMP = duration(min) × ΔHR_ratio × 0.64 × e^(1.92 × ΔHR_ratio)
// ΔHR_ratio = (avgHR - restingHR) / (maxHR - restingHR)

export function computeTRIMP(session: Session, profile: UserProfile): number {
  if (!session.avgHR) return 0;
  const restHR = session.restingHR ?? profile.restingHR;
  const hrReserve = profile.maxHR - restHR;
  if (hrReserve <= 0) return 0;

  const deltaRatio = (session.avgHR - restHR) / hrReserve;
  const clampedRatio = Math.max(0, Math.min(1, deltaRatio));

  return session.duration * clampedRatio * 0.64 * Math.exp(1.92 * clampedRatio);
}

// ── sRPE (Session RPE × duration) ──────────────────────────────
// Foster et al. — simple and robust when HR data unavailable

export function computeSRPE(session: Session): number {
  return session.rpe * session.duration;
}

// ── TSS-like (simplified) ──────────────────────────────────────
// TSS = (duration_sec × NP × IF) / (FTP × 3600) × 100
// Simplifié pour running : on utilise le ratio HR/LTHR comme proxy d'IF

export function computeTSS(session: Session, profile: UserProfile): number {
  if (!session.avgHR) {
    // Fallback: estimation via RPE (mapping RPE 1-10 → IF 0.5-1.1)
    const estimatedIF = 0.4 + session.rpe * 0.07;
    return (session.duration / 60) * estimatedIF * estimatedIF * 100;
  }

  const intensityFactor = session.avgHR / profile.lactateThresholdHR;
  return (session.duration / 60) * intensityFactor * intensityFactor * 100;
}

// ── Aggregate daily metrics ────────────────────────────────────

export function aggregateDailyMetrics(
  sessions: Session[],
  profile: UserProfile,
): DailyMetrics[] {
  const byDate = new Map<string, Session[]>();

  for (const s of sessions) {
    const existing = byDate.get(s.date) ?? [];
    existing.push(s);
    byDate.set(s.date, existing);
  }

  const result: DailyMetrics[] = [];
  for (const [date, daySessions] of byDate) {
    let trimp = 0;
    let srpe = 0;
    let tss = 0;

    for (const s of daySessions) {
      trimp += computeTRIMP(s, profile);
      srpe += computeSRPE(s);
      tss += computeTSS(s, profile);
    }

    result.push({ date, trimp, srpe, tss, sessionCount: daySessions.length });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ── EWMA (Exponentially Weighted Moving Average) ───────────────

function ewma(values: number[], halfLife: number): number[] {
  const alpha = 1 - Math.exp(-Math.LN2 / halfLife);
  const result: number[] = [];
  let acc = values[0] ?? 0;

  for (let i = 0; i < values.length; i++) {
    acc = alpha * (values[i] ?? 0) + (1 - alpha) * acc;
    result.push(acc);
  }
  return result;
}

// ── Rolling metrics (ATL, CTL, TSB, Monotony, Strain) ──────────

export function computeRollingMetrics(
  dailyMetrics: DailyMetrics[],
): RollingMetrics[] {
  if (dailyMetrics.length === 0) return [];

  // Fill gaps: create a continuous daily series
  const startDate = new Date(dailyMetrics[0]!.date);
  const endDate = new Date(dailyMetrics[dailyMetrics.length - 1]!.date);
  const metricsMap = new Map(dailyMetrics.map((m) => [m.date, m]));

  const continuousTSS: number[] = [];
  const continuousDates: string[] = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    continuousDates.push(dateStr);
    continuousTSS.push(metricsMap.get(dateStr)?.tss ?? 0);
  }

  // EWMA for ATL (7-day) and CTL (42-day)
  const atl = ewma(continuousTSS, 7);
  const ctl = ewma(continuousTSS, 42);

  const results: RollingMetrics[] = [];

  for (let i = 0; i < continuousDates.length; i++) {
    // Monotony & Strain (7-day window)
    const windowStart = Math.max(0, i - 6);
    const window = continuousTSS.slice(windowStart, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance =
      window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window.length;
    const std = Math.sqrt(variance);
    const monotony = std > 0 ? mean / std : 0;
    const weeklyLoad = window.reduce((a, b) => a + b, 0);
    const strain = weeklyLoad * monotony;

    results.push({
      date: continuousDates[i]!,
      atl: atl[i]!,
      ctl: ctl[i]!,
      tsb: ctl[i]! - atl[i]!,
      monotony,
      strain,
    });
  }

  return results;
}

// ── Summary helpers ────────────────────────────────────────────

export function weeklyVolume(sessions: Session[], weekStartISO: string): number {
  const start = new Date(weekStartISO);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return sessions
    .filter((s) => s.date >= weekStartISO && s.date < end.toISOString().slice(0, 10))
    .reduce((sum, s) => sum + s.duration, 0);
}

// ── Session types ──────────────────────────────────────────────

export type ActivityType =
  | "trail"
  | "road_run"
  | "bike"
  | "hike"
  | "strength"
  | "other";

export type Phase =
  | "pre_depart"
  | "bikepacking"
  | "specifique_trail"
  | "affutage";

export interface Session {
  id?: number;
  date: string; // ISO date
  type: ActivityType;
  duration: number; // minutes
  distance?: number; // km
  elevation?: number; // m D+
  avgHR?: number;
  maxHR?: number;
  restingHR?: number; // HR at rest that day
  rpe: number; // 1-10 Borg CR-10
  notes?: string;
}

// ── User profile ───────────────────────────────────────────────

export interface UserProfile {
  id?: number;
  restingHR: number;
  maxHR: number;
  lactateThresholdHR: number;
  raceDate: string; // ISO date
  targetTime?: string; // e.g. "14:00"
  weight?: number; // kg
  trainingLevel?: "beginner" | "intermediate" | "advanced";
  weeklyVolumeTarget?: number; // hours
}

// ── Computed metrics ───────────────────────────────────────────

export interface DailyMetrics {
  date: string;
  trimp: number;
  srpe: number;
  tss: number;
  sessionCount: number;
}

export interface RollingMetrics {
  date: string;
  atl: number; // Acute Training Load (7d EWMA)
  ctl: number; // Chronic Training Load (42d EWMA)
  tsb: number; // Training Stress Balance = CTL - ATL
  monotony: number; // 7d mean / 7d std
  strain: number; // 7d sum × monotony
}

// ── Training plan ──────────────────────────────────────────────

export interface PlanWeek {
  weekNumber: number;
  startDate: string;
  phase: Phase;
  label: string;
  targetVolume?: number; // hours
  isRecovery: boolean;
  notes: string;
}

export interface PlanAdjustment {
  id?: string; // week startDate ISO
  weekStartDate: string;
  targetVolume?: number;
  notes?: string;
  isRecovery?: boolean;
}

// ── Constants ──────────────────────────────────────────────────

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  trail: "Trail",
  road_run: "Course route",
  bike: "Vélo",
  hike: "Rando",
  strength: "Renfo",
  other: "Autre",
};

export const PHASE_LABELS: Record<Phase, string> = {
  pre_depart: "Pré-départ",
  bikepacking: "Bikepacking EV1",
  specifique_trail: "Spécifique Trail",
  affutage: "Affûtage",
};

export const PHASE_COLORS: Record<Phase, string> = {
  pre_depart: "#a78bfa",
  bikepacking: "#38bdf8",
  specifique_trail: "#4ade80",
  affutage: "#fbbf24",
};

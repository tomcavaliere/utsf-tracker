import type {
  Phase,
  PlanAdjustment,
  PlanWeek,
  UserProfile,
} from "@/models/types";

// ── Plan phases definition ─────────────────────────────────────
// Race date: 2026-10-02
// S1 starts: 2026-04-13 (Monday after today)

interface PhaseDefinition {
  phase: Phase;
  label: string;
  weeks: number;
  notes: string[];
  recoveryPattern: number[]; // indices of recovery weeks (0-based within phase)
  baseVolume: number; // hours
  peakVolume: number;
}

const PHASES: PhaseDefinition[] = [
  {
    phase: "pre_depart",
    label: "Pré-départ",
    weeks: 2,
    notes: [
      "Maintien volume trail, pas d'intensité. Test matos vélo.",
      "Dernière semaine: réduction 20%. Renfo excentrique.",
    ],
    recoveryPattern: [],
    baseVolume: 10,
    peakVolume: 10,
  },
  {
    phase: "bikepacking",
    label: "Bikepacking EuroVelo 1",
    weeks: 9,
    notes: [
      "Adaptation selle, 80-100 km/jour. 2 courses EF 45'.",
      "Montée progressive distance vélo. 2 courses dont 1 qualité.",
      "Croisière. 2 courses + 1 renfo bivouac.",
      "Récupération: journée courte vélo, 1 footing léger.",
      "Volume vélo max. 3 courses dont tempo 25'.",
      "Exploration. 2 courses EF + fentes/gainage.",
      "2 courses dont 6×4' VMA si terrain adapté.",
      "Récupération: repos vélo, 1 footing 40'.",
      "Dernière semaine EV1. 2 courses légères. Récup voyage retour.",
    ],
    recoveryPattern: [3, 7],
    baseVolume: 15,
    peakVolume: 20,
  },
  {
    phase: "specifique_trail",
    label: "Spécifique Trail Alpes",
    weeks: 11,
    notes: [
      "TRANSITION: reprise trail progressive 4-5h. Pas de D+ violent.",
      "TRANSITION: allonger à 6h. D+ modéré. Excentrique++.",
      "TRANSITION: première longue 2h30 avec D+. Mollets attention.",
      "Montée charge: 8h, back-to-back weekend.",
      "10h charge. Seuil côtes + longue 3h30 D+.",
      "Récupération: 6h max, footings EF.",
      "12h charge. Longue 4h30 spé UTSF. Test nutrition.",
      "Pic charge: 14h. Back-to-back, simulation ravitaillement.",
      "Course prépa 40-60km trail. Caler la stratégie.",
      "12h. Dernière longue 5h. Gestion nuit si applicable.",
      "Début réduction. 8h. Qualité maintenue, volume baissé.",
    ],
    recoveryPattern: [5],
    baseVolume: 5,
    peakVolume: 14,
  },
  {
    phase: "affutage",
    label: "Affûtage",
    weeks: 3,
    notes: [
      "Taper S1: -35% volume. 1 séance qualité courte.",
      "Taper S2: -50%. Footings entretien. Préparation logistique.",
      "Race week: 2×30' légers. Repos J-2/J-1. Check drop bags.",
    ],
    recoveryPattern: [],
    baseVolume: 6,
    peakVolume: 3,
  },
];

// ── Generate plan weeks ────────────────────────────────────────

export function generatePlan(startDate: string = "2026-04-13"): PlanWeek[] {
  const weeksToRace = 25;
  const race = new Date(startDate);
  const monday = new Date(race);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const planStart = new Date(monday);
  planStart.setDate(planStart.getDate() - (weeksToRace - 1) * 7);

  return generatePlanFromStartDate(planStart.toISOString().slice(0, 10));
}

function generatePlanFromStartDate(startDate: string): PlanWeek[] {
  const weeks: PlanWeek[] = [];
  const currentDate = new Date(startDate);
  let weekNumber = 1;

  for (const phase of PHASES) {
    for (let i = 0; i < phase.weeks; i++) {
      const isRecovery = phase.recoveryPattern.includes(i);
      const progress = i / (phase.weeks - 1 || 1);
      const targetVolume = isRecovery
        ? phase.baseVolume * 0.6
        : phase.baseVolume + (phase.peakVolume - phase.baseVolume) * progress;

      weeks.push({
        weekNumber,
        startDate: currentDate.toISOString().slice(0, 10),
        phase: phase.phase,
        label: `S${weekNumber} — ${phase.label}`,
        targetVolume: Math.round(targetVolume * 10) / 10,
        isRecovery,
        notes: phase.notes[i] ?? "",
      });

      currentDate.setDate(currentDate.getDate() + 7);
      weekNumber++;
    }
  }

  return weeks;
}

export function generatePlanForProfile(
  profile: UserProfile,
  adjustments: PlanAdjustment[] = [],
): PlanWeek[] {
  const plan = generatePlan(profile.raceDate);
  const levelFactor =
    profile.trainingLevel === "beginner"
      ? 0.85
      : profile.trainingLevel === "advanced"
        ? 1.15
        : 1;
  const targetFactor =
    profile.weeklyVolumeTarget && profile.weeklyVolumeTarget > 0
      ? profile.weeklyVolumeTarget / 10
      : 1;
  const volumeFactor = Math.min(1.6, Math.max(0.6, levelFactor * targetFactor));

  const adjustmentMap = new Map(adjustments.map((a) => [a.weekStartDate, a]));
  return plan.map((week) => {
    const adjustment = adjustmentMap.get(week.startDate);
    const scaledTargetVolume =
      week.targetVolume !== undefined
        ? Math.max(1, Math.round(week.targetVolume * volumeFactor * 10) / 10)
        : undefined;

    return {
      ...week,
      targetVolume: adjustment?.targetVolume ?? scaledTargetVolume,
      notes: adjustment?.notes ?? week.notes,
      isRecovery: adjustment?.isRecovery ?? week.isRecovery,
    };
  });
}

// ── Get current phase/week ─────────────────────────────────────

export function getCurrentWeek(plan: PlanWeek[]): PlanWeek | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return [...plan].reverse().find((w) => w.startDate <= today);
}

export function getPhaseForDate(date: string): Phase {
  const plan = generatePlan("2026-10-02");
  const week = [...plan].reverse().find((w) => w.startDate <= date);
  return week?.phase ?? "pre_depart";
}

export function daysUntilRace(raceDate: string): number {
  const race = new Date(raceDate);
  const now = new Date();
  return Math.ceil((race.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

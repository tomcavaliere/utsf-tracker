import Dexie, { type EntityTable } from "dexie";
import type { PlanAdjustment, Session, UserProfile } from "@/models/types";

const db = new Dexie("UTSFTracker") as Dexie & {
  sessions: EntityTable<Session, "id">;
  profile: EntityTable<UserProfile, "id">;
  planAdjustments: EntityTable<PlanAdjustment, "id">;
};

db.version(1).stores({
  sessions: "++id, date, type",
  profile: "++id",
});

db.version(2).stores({
  sessions: "++id, date, type",
  profile: "++id",
  planAdjustments: "weekStartDate",
});

export { db };

// ── Profile helpers ────────────────────────────────────────────

const DEFAULT_PROFILE: Omit<UserProfile, "id"> = {
  restingHR: 48,
  maxHR: 190,
  lactateThresholdHR: 170,
  raceDate: "2026-10-02",
  targetTime: undefined,
  weight: 72,
  trainingLevel: "intermediate",
  weeklyVolumeTarget: 10,
};

export async function getProfile(): Promise<UserProfile> {
  const existing = await db.profile.toCollection().first();
  if (existing) return existing;
  const id = await db.profile.add(DEFAULT_PROFILE as UserProfile);
  return { ...DEFAULT_PROFILE, id } as UserProfile;
}

export async function updateProfile(
  data: Partial<UserProfile>,
): Promise<void> {
  const profile = await getProfile();
  await db.profile.update(profile.id!, data);
}

// ── Export / Import ────────────────────────────────────────────

export async function exportData(): Promise<string> {
  const sessions = await db.sessions.toArray();
  const profile = await getProfile();
  const planAdjustments = await db.planAdjustments.toArray();
  return JSON.stringify(
    { sessions, profile, planAdjustments, exportedAt: new Date().toISOString() },
    null,
    2,
  );
}

export async function importData(json: string): Promise<void> {
  const parsed: unknown = JSON.parse(json);
  const data = validateImportData(parsed);

  await db.transaction("rw", db.sessions, db.profile, async () => {
    await db.sessions.clear();
    await db.profile.clear();
    await db.sessions.bulkAdd(data.sessions);
    await db.profile.add(data.profile);
  });

  await db.transaction("rw", db.planAdjustments, async () => {
    await db.planAdjustments.clear();
    if (data.planAdjustments.length > 0) {
      await db.planAdjustments.bulkPut(
        data.planAdjustments.map((x) => ({ ...x, id: x.weekStartDate })),
      );
    }
  });
}

export async function getPlanAdjustments(): Promise<PlanAdjustment[]> {
  return db.planAdjustments.toArray();
}

export async function upsertPlanAdjustment(
  adjustment: PlanAdjustment,
): Promise<void> {
  await db.planAdjustments.put({
    ...adjustment,
    id: adjustment.weekStartDate,
  });
}

export async function deletePlanAdjustment(weekStartDate: string): Promise<void> {
  await db.planAdjustments.delete(weekStartDate);
}

function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isActivityType(value: string): value is Session["type"] {
  return ["trail", "road_run", "bike", "hike", "strength", "other"].includes(
    value,
  );
}

function assertNumberInRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Champ invalide: ${field}`);
  }
  if (value < min || value > max) {
    throw new Error(`Valeur hors bornes pour ${field}`);
  }
  return value;
}

function validateImportData(data: unknown): {
  sessions: Session[];
  profile: UserProfile;
  planAdjustments: PlanAdjustment[];
} {
  if (!data || typeof data !== "object") {
    throw new Error("Format JSON invalide");
  }

  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.sessions)) {
    throw new Error("Le backup doit contenir un tableau sessions");
  }
  if (!obj.profile || typeof obj.profile !== "object") {
    throw new Error("Le backup doit contenir un profil valide");
  }

  const sessions: Session[] = obj.sessions.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`Séance #${index + 1} invalide`);
    }
    const s = raw as Record<string, unknown>;
    if (typeof s.date !== "string" || !isISODate(s.date)) {
      throw new Error(`Séance #${index + 1}: date invalide`);
    }
    if (typeof s.type !== "string" || !isActivityType(s.type)) {
      throw new Error(`Séance #${index + 1}: type invalide`);
    }
    const duration = assertNumberInRange(s.duration, "duration", 1, 1440);
    const rpe = assertNumberInRange(s.rpe, "rpe", 1, 10);

    const optionalNumber = (
      value: unknown,
      field: string,
      min: number,
      max: number,
    ): number | undefined => {
      if (value === null || value === undefined || value === "") return undefined;
      return assertNumberInRange(value, field, min, max);
    };

    return {
      id: typeof s.id === "number" ? s.id : undefined,
      date: s.date,
      type: s.type,
      duration,
      rpe,
      distance: optionalNumber(s.distance, "distance", 0, 1000),
      elevation: optionalNumber(s.elevation, "elevation", 0, 20000),
      avgHR: optionalNumber(s.avgHR, "avgHR", 30, 240),
      maxHR: optionalNumber(s.maxHR, "maxHR", 30, 240),
      restingHR: optionalNumber(s.restingHR, "restingHR", 20, 120),
      notes: typeof s.notes === "string" ? s.notes.slice(0, 1000) : undefined,
    };
  });

  const profileRaw = obj.profile as Record<string, unknown>;
  if (typeof profileRaw.raceDate !== "string" || !isISODate(profileRaw.raceDate)) {
    throw new Error("Profil: date course invalide");
  }
  const profile: UserProfile = {
    id: typeof profileRaw.id === "number" ? profileRaw.id : undefined,
    restingHR: assertNumberInRange(profileRaw.restingHR, "restingHR", 20, 120),
    maxHR: assertNumberInRange(profileRaw.maxHR, "maxHR", 100, 240),
    lactateThresholdHR: assertNumberInRange(
      profileRaw.lactateThresholdHR,
      "lactateThresholdHR",
      80,
      230,
    ),
    raceDate: profileRaw.raceDate,
    targetTime:
      typeof profileRaw.targetTime === "string" ? profileRaw.targetTime : undefined,
    weight:
      typeof profileRaw.weight === "number" && profileRaw.weight > 0
        ? profileRaw.weight
        : undefined,
    trainingLevel:
      profileRaw.trainingLevel === "beginner" ||
      profileRaw.trainingLevel === "intermediate" ||
      profileRaw.trainingLevel === "advanced"
        ? profileRaw.trainingLevel
        : "intermediate",
    weeklyVolumeTarget:
      typeof profileRaw.weeklyVolumeTarget === "number" &&
      profileRaw.weeklyVolumeTarget > 0
        ? profileRaw.weeklyVolumeTarget
        : 10,
  };

  const planAdjustmentsRaw = Array.isArray(obj.planAdjustments)
    ? obj.planAdjustments
    : [];
  const planAdjustments: PlanAdjustment[] = planAdjustmentsRaw
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Record<string, unknown>)
    .filter(
      (item) =>
        typeof item.weekStartDate === "string" && isISODate(item.weekStartDate),
    )
    .map((item) => ({
      weekStartDate: item.weekStartDate as string,
      targetVolume:
        typeof item.targetVolume === "number" && item.targetVolume >= 0
          ? item.targetVolume
          : undefined,
      notes: typeof item.notes === "string" ? item.notes.slice(0, 300) : undefined,
      isRecovery:
        typeof item.isRecovery === "boolean" ? item.isRecovery : undefined,
    }));

  return { sessions, profile, planAdjustments };
}

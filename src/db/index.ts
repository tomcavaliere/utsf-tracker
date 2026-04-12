import Dexie, { type EntityTable } from "dexie";
import type { Session, UserProfile } from "@/models/types";

const db = new Dexie("UTSFTracker") as Dexie & {
  sessions: EntityTable<Session, "id">;
  profile: EntityTable<UserProfile, "id">;
};

db.version(1).stores({
  sessions: "++id, date, type",
  profile: "++id",
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
  return JSON.stringify({ sessions, profile, exportedAt: new Date().toISOString() }, null, 2);
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json) as {
    sessions: Session[];
    profile: UserProfile;
  };
  await db.transaction("rw", db.sessions, db.profile, async () => {
    await db.sessions.clear();
    await db.profile.clear();
    await db.sessions.bulkAdd(data.sessions);
    await db.profile.add(data.profile);
  });
}

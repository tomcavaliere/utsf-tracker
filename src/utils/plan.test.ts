import { describe, expect, it } from "vitest";
import { daysUntilRace, generatePlanForProfile } from "@/utils/plan";
import type { PlanAdjustment, UserProfile } from "@/models/types";

const profile: UserProfile = {
  id: 1,
  restingHR: 48,
  maxHR: 190,
  lactateThresholdHR: 170,
  raceDate: "2026-10-02",
  trainingLevel: "advanced",
  weeklyVolumeTarget: 12,
};

describe("plan generation", () => {
  it("creates a 25-week profile-based plan", () => {
    const plan = generatePlanForProfile(profile);
    expect(plan).toHaveLength(25);
    expect(plan[0]?.weekNumber).toBe(1);
    expect(plan.at(-1)?.startDate <= profile.raceDate).toBe(true);
  });

  it("applies manual week adjustments", () => {
    const adjustments: PlanAdjustment[] = [
      {
        weekStartDate: "2026-04-13",
        targetVolume: 8,
        notes: "Semaine allégée",
        isRecovery: true,
      },
    ];
    const plan = generatePlanForProfile(profile, adjustments);
    const week = plan.find((w) => w.startDate === "2026-04-13");
    expect(week?.targetVolume).toBe(8);
    expect(week?.notes).toBe("Semaine allégée");
    expect(week?.isRecovery).toBe(true);
  });

  it("computes remaining days until race", () => {
    expect(daysUntilRace("2030-01-01")).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  aggregateDailyMetrics,
  computeRollingMetrics,
  computeSRPE,
  computeTRIMP,
  computeTSS,
} from "@/utils/metrics";
import type { Session, UserProfile } from "@/models/types";

const profile: UserProfile = {
  id: 1,
  restingHR: 50,
  maxHR: 190,
  lactateThresholdHR: 170,
  raceDate: "2026-10-02",
};

const baseSession: Session = {
  id: 1,
  date: "2026-04-01",
  type: "trail",
  duration: 60,
  avgHR: 150,
  rpe: 6,
};

describe("metrics helpers", () => {
  it("computes TRIMP and SRPE with expected ranges", () => {
    const trimp = computeTRIMP(baseSession, profile);
    const srpe = computeSRPE(baseSession);
    expect(trimp).toBeGreaterThan(0);
    expect(srpe).toBe(360);
  });

  it("computes TSS from HR and fallback RPE", () => {
    const tssFromHR = computeTSS(baseSession, profile);
    const tssFromRpe = computeTSS({ ...baseSession, avgHR: undefined }, profile);
    expect(tssFromHR).toBeGreaterThan(0);
    expect(tssFromRpe).toBeGreaterThan(0);
  });

  it("aggregates and computes rolling metrics", () => {
    const sessions: Session[] = [
      baseSession,
      { ...baseSession, id: 2, date: "2026-04-02", rpe: 7, avgHR: 155 },
      { ...baseSession, id: 3, date: "2026-04-04", rpe: 4, avgHR: undefined },
    ];
    const daily = aggregateDailyMetrics(sessions, profile);
    const rolling = computeRollingMetrics(daily);
    expect(daily.length).toBe(3);
    expect(rolling.length).toBeGreaterThanOrEqual(4);
    expect(rolling.at(-1)?.atl).toBeDefined();
    expect(rolling.at(-1)?.ctl).toBeDefined();
    expect(rolling.at(-1)?.tsb).toBeDefined();
  });
});

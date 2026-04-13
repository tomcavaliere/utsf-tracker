import { describe, expect, it } from "vitest";
import { parseActivitiesCsv } from "@/utils/activitiesCsv";

describe("parseActivitiesCsv", () => {
  it("parses common Strava-like English CSV format", () => {
    const csv = [
      "Activity Date,Activity Type,Moving Time,Distance,Elevation Gain,Average Heart Rate,Max Heart Rate,Activity Name",
      "2026-01-10 07:32:00,Trail Run,01:23:00,12.4,640,151,173,Sortie colline",
    ].join("\n");

    const sessions = parseActivitiesCsv(csv);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      date: "2026-01-10",
      type: "trail",
      duration: 83,
      distance: 12.4,
      elevation: 640,
      avgHR: 151,
      maxHR: 173,
    });
  });

  it("parses semicolon CSV with French-style numbers and date", () => {
    const csv = [
      "Date de l'activité;Type d'activité;Durée;Distance;Dénivelé positif;Nom",
      "13/02/2026;Course à pied;01:00:00;10,5;120;Footing tempo",
    ].join("\n");

    const sessions = parseActivitiesCsv(csv);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      date: "2026-02-13",
      type: "road_run",
      duration: 60,
      distance: 10.5,
      elevation: 120,
      notes: "Footing tempo",
    });
  });

  it("skips invalid rows missing date or duration", () => {
    const csv = [
      "Activity Date,Activity Type,Moving Time",
      ",Ride,00:45:00",
      "2026-03-01,Ride,",
      "2026-03-02,Ride,00:45:00",
    ].join("\n");

    const sessions = parseActivitiesCsv(csv);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.date).toBe("2026-03-02");
  });
});

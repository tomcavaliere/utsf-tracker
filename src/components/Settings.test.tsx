import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Settings from "@/components/Settings";
import type { UserProfile } from "@/models/types";

const profile: UserProfile = {
  id: 1,
  restingHR: 48,
  maxHR: 190,
  lactateThresholdHR: 170,
  raceDate: "2026-10-02",
  trainingLevel: "intermediate",
  weeklyVolumeTarget: 10,
};

const mockGetProfile = vi.fn(async () => profile);
const mockUpdateProfile = vi.fn(async () => undefined);
const mockExportData = vi.fn(async () => "{}");
const mockImportData = vi.fn(async () => undefined);

vi.mock("@/db", () => ({
  getProfile: mockGetProfile,
  updateProfile: mockUpdateProfile,
  exportData: mockExportData,
  importData: mockImportData,
}));

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents invalid profile save", async () => {
    render(<Settings />);
    const restingHrInput = await screen.findByDisplayValue("48");

    fireEvent.change(restingHrInput, { target: { value: "10" } });
    fireEvent.click(screen.getByText("Sauvegarder"));

    expect(await screen.findByText("FC repos invalide (20-120).")).toBeVisible();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("saves profile when valid", async () => {
    render(<Settings />);
    await screen.findByDisplayValue("48");

    fireEvent.click(screen.getByText("Sauvegarder"));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledTimes(1));
  });
});

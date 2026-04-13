import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  deletePlanAdjustment,
  getPlanAdjustments,
  getProfile,
  upsertPlanAdjustment,
} from "@/db";
import { generatePlanForProfile, getCurrentWeek } from "@/utils/plan";
import { PHASE_LABELS, PHASE_COLORS, type Phase } from "@/models/types";
import { ChevronRight, Battery } from "lucide-react";

export default function TrainingPlan() {
  const sessions = useLiveQuery(() => db.sessions.toArray()) ?? [];
  const profile = useLiveQuery(() => getProfile());
  const adjustments = useLiveQuery(() => getPlanAdjustments()) ?? [];
  const plan = profile ? generatePlanForProfile(profile, adjustments) : [];
  const currentWeek = getCurrentWeek(plan);
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editRecovery, setEditRecovery] = useState(false);

  // Group weeks by phase
  const phases = new Map<Phase, typeof plan>();
  for (const week of plan) {
    const existing = phases.get(week.phase) ?? [];
    existing.push(week);
    phases.set(week.phase, existing);
  }

  // Actual volume per week
  function weekVolume(startDate: string): number {
    const end = new Date(startDate);
    end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().slice(0, 10);
    return sessions
      .filter((s) => s.date >= startDate && s.date < endStr)
      .reduce((sum, s) => sum + s.duration, 0);
  }

  async function openEditor(startDate: string) {
    const week = plan.find((w) => w.startDate === startDate);
    if (!week) return;
    setEditingWeek(startDate);
    setEditTarget(week.targetVolume?.toString() ?? "");
    setEditNotes(week.notes);
    setEditRecovery(week.isRecovery);
  }

  async function saveAdjustment() {
    if (!editingWeek) return;
    const target = editTarget.trim() ? Number(editTarget) : undefined;
    if (
      target !== undefined &&
      (!Number.isFinite(target) || target < 0 || target > 40)
    ) {
      return;
    }
    await upsertPlanAdjustment({
      weekStartDate: editingWeek,
      targetVolume: target,
      notes: editNotes.trim() || undefined,
      isRecovery: editRecovery,
    });
    setEditingWeek(null);
  }

  async function resetAdjustment(startDate: string) {
    await deletePlanAdjustment(startDate);
    if (editingWeek === startDate) setEditingWeek(null);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Plan d'entraînement</h2>
      <p className="text-sm text-gray-400">
        25 semaines · plan calculé dynamiquement selon ton profil
      </p>

      {Array.from(phases.entries()).map(([phase, weeks]) => (
        <div key={phase} className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: PHASE_COLORS[phase] }}
            />
            <h3
              className="font-semibold"
              style={{ color: PHASE_COLORS[phase] }}
            >
              {PHASE_LABELS[phase]}
            </h3>
            <span className="text-xs text-gray-600">
              {weeks.length} semaines
            </span>
          </div>

          <div className="space-y-1">
            {weeks.map((week) => {
              const isCurrent = currentWeek?.weekNumber === week.weekNumber;
              const actualMin = weekVolume(week.startDate);
              const actualH = actualMin / 60;
              const isPast =
                week.startDate < new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={week.weekNumber}
                  className={`rounded-lg px-4 py-3 border transition-colors ${
                    isCurrent
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-gray-800 bg-gray-900"
                  } ${isPast && !isCurrent ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isCurrent && (
                        <ChevronRight
                          size={14}
                          className="text-brand-400 animate-pulse"
                        />
                      )}
                      {week.isRecovery && (
                        <Battery size={14} className="text-yellow-400" />
                      )}
                      <span className="text-sm font-medium">
                        S{week.weekNumber}
                      </span>
                      <span className="text-xs text-gray-500">
                        {week.startDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {week.targetVolume && (
                        <span className="text-gray-500">
                          {actualH > 0 && (
                            <span
                              className={
                                actualH >= (week.targetVolume ?? 0) * 0.9
                                  ? "text-green-400"
                                  : "text-orange-400"
                              }
                            >
                              {actualH.toFixed(1)}h /
                            </span>
                          )}{" "}
                          {week.targetVolume}h
                        </span>
                      )}
                      {week.isRecovery && (
                        <span className="text-yellow-400 font-semibold">
                          RÉCUP
                        </span>
                      )}
                      <button
                        onClick={() => openEditor(week.startDate)}
                        className="text-brand-400 hover:text-brand-300 font-semibold"
                      >
                        Ajuster
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{week.notes}</p>
                  {week.targetVolume !== undefined && (
                    <div className="mt-2 text-xs text-gray-500">
                      Prévu: {week.targetVolume}h · Réalisé:{" "}
                      {actualH.toFixed(1)}h
                    </div>
                  )}

                  {editingWeek === week.startDate && (
                    <div className="mt-3 p-3 rounded-lg bg-gray-950 border border-gray-700 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">
                            Volume cible (h)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={40}
                            step={0.5}
                            value={editTarget}
                            onChange={(e) => setEditTarget(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-gray-300 mt-5">
                          <input
                            type="checkbox"
                            checked={editRecovery}
                            onChange={(e) => setEditRecovery(e.target.checked)}
                          />
                          Semaine de récupération
                        </label>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Notes
                        </label>
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={2}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveAdjustment}
                          className="px-3 py-1.5 rounded bg-brand-600 text-white text-xs font-semibold"
                        >
                          Sauvegarder
                        </button>
                        <button
                          onClick={() => setEditingWeek(null)}
                          className="px-3 py-1.5 rounded bg-gray-700 text-gray-200 text-xs font-semibold"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => resetAdjustment(week.startDate)}
                          className="px-3 py-1.5 rounded bg-red-900/60 text-red-200 text-xs font-semibold"
                        >
                          Réinitialiser
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

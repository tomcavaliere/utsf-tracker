import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { generatePlan, getCurrentWeek } from "@/utils/plan";
import { PHASE_LABELS, PHASE_COLORS, type Phase } from "@/models/types";
import { ChevronRight, Dumbbell, Battery } from "lucide-react";

export default function TrainingPlan() {
  const sessions = useLiveQuery(() => db.sessions.toArray()) ?? [];
  const plan = generatePlan();
  const currentWeek = getCurrentWeek(plan);

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

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Plan d'entraînement</h2>
      <p className="text-sm text-gray-400">
        25 semaines · 12 avril → 2 octobre 2026
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
                week.startDate <
                new Date().toISOString().slice(0, 10);

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
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{week.notes}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

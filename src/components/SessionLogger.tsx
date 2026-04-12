import { useState } from "react";
import { db } from "@/db";
import {
  type ActivityType,
  ACTIVITY_LABELS,
} from "@/models/types";
import { Save, CheckCircle } from "lucide-react";

const ACTIVITY_TYPES: ActivityType[] = [
  "trail",
  "road_run",
  "bike",
  "hike",
  "strength",
  "other",
];

const RPE_LABELS: Record<number, string> = {
  1: "Repos",
  2: "Très facile",
  3: "Facile",
  4: "Modéré",
  5: "Moyen",
  6: "Soutenu",
  7: "Dur",
  8: "Très dur",
  9: "Extrême",
  10: "Maximal",
};

function RPESelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">RPE</span>
        <span className="font-semibold">
          {value} — {RPE_LABELS[value]}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-brand-500"
      />
      <div className="flex justify-between text-xs text-gray-600">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

export default function SessionLogger() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "trail" as ActivityType,
    duration: 60,
    distance: undefined as number | undefined,
    elevation: undefined as number | undefined,
    avgHR: undefined as number | undefined,
    maxHR: undefined as number | undefined,
    rpe: 5,
    notes: "",
  });

  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.sessions.add({
      date: form.date,
      type: form.type,
      duration: form.duration,
      distance: form.distance || undefined,
      elevation: form.elevation || undefined,
      avgHR: form.avgHR || undefined,
      maxHR: form.maxHR || undefined,
      rpe: form.rpe,
      notes: form.notes || undefined,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // Reset form for next entry
    setForm((f) => ({
      ...f,
      duration: 60,
      distance: undefined,
      elevation: undefined,
      avgHR: undefined,
      maxHR: undefined,
      rpe: 5,
      notes: "",
    }));
  };

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition-colors";

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Enregistrer une séance</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date + Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Type</label>
            <select
              value={form.type}
              onChange={(e) => update("type", e.target.value as ActivityType)}
              className={inputClass}
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Duration + Distance + Elevation */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Durée (min) *
            </label>
            <input
              type="number"
              value={form.duration}
              onChange={(e) => update("duration", Number(e.target.value))}
              min={1}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Distance (km)
            </label>
            <input
              type="number"
              step="0.1"
              value={form.distance ?? ""}
              onChange={(e) =>
                update(
                  "distance",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">D+ (m)</label>
            <input
              type="number"
              value={form.elevation ?? ""}
              onChange={(e) =>
                update(
                  "elevation",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              className={inputClass}
            />
          </div>
        </div>

        {/* Heart rate */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              FC moy (bpm)
            </label>
            <input
              type="number"
              value={form.avgHR ?? ""}
              onChange={(e) =>
                update(
                  "avgHR",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              FC max (bpm)
            </label>
            <input
              type="number"
              value={form.maxHR ?? ""}
              onChange={(e) =>
                update(
                  "maxHR",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              className={inputClass}
            />
          </div>
        </div>

        {/* RPE slider */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <RPESelector value={form.rpe} onChange={(v) => update("rpe", v)} />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            rows={3}
            placeholder="Sensations, terrain, météo..."
            className={inputClass + " resize-none"}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
            saved
              ? "bg-green-600 text-white"
              : "bg-brand-600 hover:bg-brand-500 text-white"
          }`}
        >
          {saved ? (
            <>
              <CheckCircle size={18} /> Enregistré !
            </>
          ) : (
            <>
              <Save size={18} /> Enregistrer
            </>
          )}
        </button>
      </form>
    </div>
  );
}

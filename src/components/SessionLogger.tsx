import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import {
  type ActivityType,
  ACTIVITY_LABELS,
  type Session,
} from "@/models/types";
import { Save, CheckCircle, Pencil, Trash2, Copy, Search } from "lucide-react";

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

type SessionForm = {
  date: string;
  type: ActivityType;
  duration: number;
  distance: number | undefined;
  elevation: number | undefined;
  avgHR: number | undefined;
  maxHR: number | undefined;
  rpe: number;
  notes: string;
};

const emptyForm = (): SessionForm => ({
  date: new Date().toISOString().slice(0, 10),
  type: "trail",
  duration: 60,
  distance: undefined,
  elevation: undefined,
  avgHR: undefined,
  maxHR: undefined,
  rpe: 5,
  notes: "",
});

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

function toForm(session: Session): SessionForm {
  return {
    date: session.date,
    type: session.type,
    duration: session.duration,
    distance: session.distance,
    elevation: session.elevation,
    avgHR: session.avgHR,
    maxHR: session.maxHR,
    rpe: session.rpe,
    notes: session.notes ?? "",
  };
}

function validateForm(form: SessionForm): string | null {
  if (!form.date) return "La date est obligatoire.";
  if (
    !Number.isFinite(form.duration) ||
    form.duration < 1 ||
    form.duration > 1440
  ) {
    return "La durée doit être entre 1 et 1440 minutes.";
  }
  if (!Number.isFinite(form.rpe) || form.rpe < 1 || form.rpe > 10) {
    return "Le RPE doit être entre 1 et 10.";
  }
  if (
    form.distance !== undefined &&
    (form.distance < 0 || form.distance > 1000)
  ) {
    return "La distance doit être entre 0 et 1000 km.";
  }
  if (
    form.elevation !== undefined &&
    (form.elevation < 0 || form.elevation > 20000)
  ) {
    return "Le dénivelé doit être entre 0 et 20000 m.";
  }
  if (form.avgHR !== undefined && (form.avgHR < 30 || form.avgHR > 240)) {
    return "La FC moyenne doit être entre 30 et 240 bpm.";
  }
  if (form.maxHR !== undefined && (form.maxHR < 30 || form.maxHR > 240)) {
    return "La FC max doit être entre 30 et 240 bpm.";
  }
  if (
    form.avgHR !== undefined &&
    form.maxHR !== undefined &&
    form.avgHR > form.maxHR
  ) {
    return "La FC moyenne ne peut pas dépasser la FC max.";
  }
  return null;
}

function normalizeForm(form: SessionForm): Omit<Session, "id"> {
  return {
    date: form.date,
    type: form.type,
    duration: form.duration,
    distance: form.distance || undefined,
    elevation: form.elevation || undefined,
    avgHR: form.avgHR || undefined,
    maxHR: form.maxHR || undefined,
    rpe: form.rpe,
    notes: form.notes.trim() || undefined,
  };
}

export default function SessionLogger() {
  const sessions = useLiveQuery(() => db.sessions.toArray()) ?? [];

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SessionForm>(emptyForm());

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SessionForm | null>(null);

  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | ActivityType>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const update = <K extends keyof SessionForm>(key: K, value: SessionForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateEdit = <K extends keyof SessionForm>(
    key: K,
    value: SessionForm[K],
  ) => {
    setEditForm((f) => (f ? { ...f, [key]: value } : f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    await db.sessions.add(normalizeForm(form));
    setError(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm((f) => ({ ...emptyForm(), date: f.date }));
  };

  const filteredSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => {
        if (a.date === b.date) return (b.id ?? 0) - (a.id ?? 0);
        return b.date.localeCompare(a.date);
      })
      .filter((s) => (filterType === "all" ? true : s.type === filterType))
      .filter((s) => (dateFrom ? s.date >= dateFrom : true))
      .filter((s) => (dateTo ? s.date <= dateTo : true))
      .filter((s) => {
        const text =
          `${ACTIVITY_LABELS[s.type]} ${s.notes ?? ""}`.toLowerCase();
        return query.trim() ? text.includes(query.trim().toLowerCase()) : true;
      });
  }, [sessions, filterType, dateFrom, dateTo, query]);

  const startEdit = (session: Session) => {
    setEditingId(session.id ?? null);
    setEditForm(toForm(session));
    setError(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    const validationError = validateForm(editForm);
    if (validationError) {
      setError(validationError);
      return;
    }
    await db.sessions.update(editingId, normalizeForm(editForm));
    setEditingId(null);
    setEditForm(null);
    setError(null);
  };

  const duplicateSession = async (session: Session) => {
    await db.sessions.add({
      ...normalizeForm(toForm(session)),
      date: new Date().toISOString().slice(0, 10),
    });
  };

  const deleteSession = async (session: Session) => {
    if (!session.id) return;
    if (!window.confirm("Supprimer cette séance ?")) return;
    await db.sessions.delete(session.id);
  };

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition-colors";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="max-w-lg">
        <h2 className="text-xl font-bold mb-4">Enregistrer une séance</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
                className={inputClass}
                required
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
                max={1440}
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
                min={0}
                max={1000}
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
                min={0}
                max={20000}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                FC moy (bpm)
              </label>
              <input
                type="number"
                min={30}
                max={240}
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
                min={30}
                max={240}
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

          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <RPESelector value={form.rpe} onChange={(v) => update("rpe", v)} />
          </div>

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

          {error && <p className="text-sm text-red-400">{error}</p>}

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

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-300">
          Historique des séances
        </h3>

        <div className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search
              size={14}
              className="absolute left-3 top-2.5 text-gray-500"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Recherche (type ou notes)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) =>
              setFilterType(e.target.value as "all" | ActivityType)
            }
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">Tous les types</option>
            {ACTIVITY_TYPES.map((t) => (
              <option value={t} key={t}>
                {ACTIVITY_LABELS[t]}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs"
            />
          </div>
        </div>

        <div className="space-y-2">
          {filteredSessions.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune séance trouvée.</p>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-lg border border-gray-800 bg-gray-950"
              >
                {editingId === s.id && editForm ? (
                  <div className="space-y-3">
                    <div className="grid md:grid-cols-4 gap-2">
                      <input
                        type="date"
                        value={editForm.date}
                        onChange={(e) => updateEdit("date", e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
                      />
                      <select
                        value={editForm.type}
                        onChange={(e) =>
                          updateEdit("type", e.target.value as ActivityType)
                        }
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
                      >
                        {ACTIVITY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {ACTIVITY_LABELS[t]}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={editForm.duration}
                        min={1}
                        max={1440}
                        onChange={(e) =>
                          updateEdit("duration", Number(e.target.value))
                        }
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        value={editForm.rpe}
                        min={1}
                        max={10}
                        onChange={(e) =>
                          updateEdit("rpe", Number(e.target.value))
                        }
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => updateEdit("notes", e.target.value)}
                      rows={2}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1.5 rounded bg-brand-600 text-white text-xs font-semibold"
                      >
                        Sauvegarder
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditForm(null);
                        }}
                        className="px-3 py-1.5 rounded bg-gray-700 text-gray-100 text-xs font-semibold"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {ACTIVITY_LABELS[s.type]} · {s.date}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {s.duration} min · RPE {s.rpe}
                        {s.distance ? ` · ${s.distance} km` : ""}
                        {s.elevation ? ` · ${s.elevation} m D+` : ""}
                      </div>
                      {s.notes && (
                        <p className="text-xs text-gray-400 mt-1">{s.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(s)}
                        className="p-1.5 rounded hover:bg-gray-800 text-gray-300"
                        aria-label="Modifier séance"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => duplicateSession(s)}
                        className="p-1.5 rounded hover:bg-gray-800 text-gray-300"
                        aria-label="Dupliquer séance"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => deleteSession(s)}
                        className="p-1.5 rounded hover:bg-gray-800 text-red-300"
                        aria-label="Supprimer séance"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

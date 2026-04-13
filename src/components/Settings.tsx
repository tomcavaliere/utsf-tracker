import { useState, useEffect } from "react";
import { getProfile, updateProfile, exportData, importData } from "@/db";
import type { UserProfile } from "@/models/types";
import { Download, Upload, Save, CheckCircle } from "lucide-react";

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setError(null);
    setMessage(null);

    if (profile.restingHR < 20 || profile.restingHR > 120) {
      setError("FC repos invalide (20-120).");
      return;
    }
    if (profile.maxHR < 100 || profile.maxHR > 240) {
      setError("FC max invalide (100-240).");
      return;
    }
    if (profile.lactateThresholdHR < 80 || profile.lactateThresholdHR > 230) {
      setError("Seuil lactique invalide (80-230).");
      return;
    }
    if (profile.maxHR <= profile.restingHR) {
      setError("FC max doit être supérieure à la FC repos.");
      return;
    }
    if (!profile.raceDate) {
      setError("La date de course est obligatoire.");
      return;
    }

    await updateProfile(profile);
    setSaved(true);
    setMessage("Profil sauvegardé.");
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    setError(null);
    setMessage(null);
    const json = await exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `utsf-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Export JSON généré.");
  };

  const handleImport = () => {
    setError(null);
    setMessage(null);
    const confirmed = window.confirm(
      "Importer un backup remplacera toutes les données actuelles. Continuer ?",
    );
    if (!confirmed) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importData(text);
        const p = await getProfile();
        setProfile(p);
        setMessage("Import réussi.");
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? `Import impossible: ${err.message}`
            : "Import impossible: fichier invalide.",
        );
      }
    };
    input.click();
  };

  if (!profile) return null;

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-bold">Paramètres</h2>

      {/* Profile */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
        <h3 className="text-sm font-semibold text-gray-400">Profil athlète</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              FC repos (bpm)
            </label>
            <input
              type="number"
              value={profile.restingHR}
              onChange={(e) =>
                setProfile({ ...profile, restingHR: Number(e.target.value) })
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
              value={profile.maxHR}
              onChange={(e) =>
                setProfile({ ...profile, maxHR: Number(e.target.value) })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Seuil lactique (bpm)
            </label>
            <input
              type="number"
              value={profile.lactateThresholdHR}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  lactateThresholdHR: Number(e.target.value),
                })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Poids (kg)
            </label>
            <input
              type="number"
              value={profile.weight ?? ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  weight: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Niveau</label>
            <select
              value={profile.trainingLevel ?? "intermediate"}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  trainingLevel: e.target.value as UserProfile["trainingLevel"],
                })
              }
              className={inputClass}
            >
              <option value="beginner">Débutant</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="advanced">Avancé</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Volume cible hebdo (h)
            </label>
            <input
              type="number"
              min={1}
              max={40}
              step={0.5}
              value={profile.weeklyVolumeTarget ?? ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  weeklyVolumeTarget: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Date course
            </label>
            <input
              type="date"
              value={profile.raceDate}
              onChange={(e) =>
                setProfile({ ...profile, raceDate: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">
              Temps cible
            </label>
            <input
              type="text"
              placeholder="14:00"
              value={profile.targetTime ?? ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  targetTime: e.target.value || undefined,
                })
              }
              className={inputClass}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          className={`w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
            saved
              ? "bg-green-600 text-white"
              : "bg-brand-600 hover:bg-brand-500 text-white"
          }`}
        >
          {saved ? (
            <>
              <CheckCircle size={16} /> Sauvegardé
            </>
          ) : (
            <>
              <Save size={16} /> Sauvegarder
            </>
          )}
        </button>
      </div>

      {/* Data management */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
        <h3 className="text-sm font-semibold text-gray-400">Données</h3>
        <p className="text-xs text-gray-500">
          Les données sont stockées localement dans le navigateur (IndexedDB).
          Exporte régulièrement un backup.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            <Download size={16} /> Exporter JSON
          </button>
          <button
            onClick={handleImport}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
          >
            <Upload size={16} /> Importer JSON
          </button>
        </div>
      </div>

      {message && (
        <p className="text-sm text-green-400 bg-green-950/20 border border-green-800/50 rounded-lg px-3 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-400 bg-red-950/20 border border-red-800/50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

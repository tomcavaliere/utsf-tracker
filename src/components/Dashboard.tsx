import { useLiveQuery } from "dexie-react-hooks";
import { db, getPlanAdjustments, getProfile } from "@/db";
import {
  aggregateDailyMetrics,
  computeRollingMetrics,
} from "@/utils/metrics";
import {
  generatePlanForProfile,
  getCurrentWeek,
  daysUntilRace,
} from "@/utils/plan";
import {
  PHASE_LABELS,
  PHASE_COLORS,
  ACTIVITY_LABELS,
  type Session,
} from "@/models/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity, Heart, Mountain, Timer, TrendingUp, TrendingDown } from "lucide-react";

function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  color = "text-brand-400",
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
        <Icon size={16} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {value}
        {unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const sessions = useLiveQuery(() => db.sessions.toArray()) ?? [];
  const profile = useLiveQuery(() => getProfile());
  const planAdjustments = useLiveQuery(() => getPlanAdjustments()) ?? [];
  const plan = profile ? generatePlanForProfile(profile, planAdjustments) : [];
  const currentWeek = getCurrentWeek(plan);
  const days = daysUntilRace(profile?.raceDate ?? "2026-10-02");

  // Weekly stats
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const mondayISO = monday.toISOString().slice(0, 10);

  const weekSessions = sessions.filter((s) => s.date >= mondayISO);
  const weekDuration = weekSessions.reduce((s, x) => s + x.duration, 0);
  const weekDistance = weekSessions.reduce((s, x) => s + (x.distance ?? 0), 0);
  const weekElevation = weekSessions.reduce(
    (s, x) => s + (x.elevation ?? 0),
    0,
  );
  const avgRPE =
    weekSessions.length > 0
      ? weekSessions.reduce((s, x) => s + x.rpe, 0) / weekSessions.length
      : 0;

  // Rolling metrics for chart
  const dailyMetrics = profile
    ? aggregateDailyMetrics(sessions, profile)
    : [];
  const rolling = computeRollingMetrics(dailyMetrics);
  const last60 = rolling.slice(-60);

  // Current form
  const latestRolling = rolling.length > 0 ? rolling[rolling.length - 1] : null;
  const last7DaysISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const sessionsLast7Days = sessions.filter((s) => s.date >= last7DaysISO).length;
  const alerts = [
    latestRolling && latestRolling.monotony > 2
      ? "Monotonie > 2.0 : pense à varier la charge ou réduire l’intensité."
      : null,
    latestRolling && latestRolling.tsb < -25
      ? "Forme (TSB) très basse : privilégie récupération active."
      : null,
    sessionsLast7Days === 0
      ? "Aucune séance sur 7 jours : vérifie la continuité de suivi."
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Phase banner */}
      {currentWeek && (
        <div
          className="rounded-xl p-4 border"
          style={{
            borderColor: PHASE_COLORS[currentWeek.phase],
            backgroundColor: PHASE_COLORS[currentWeek.phase] + "10",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: PHASE_COLORS[currentWeek.phase] }}
              >
                {PHASE_LABELS[currentWeek.phase]}
              </div>
              <div className="text-lg font-bold mt-1">{currentWeek.label}</div>
              <div className="text-sm text-gray-400 mt-1">
                {currentWeek.notes}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-brand-400">{days}</div>
              <div className="text-xs text-gray-500">J-race</div>
            </div>
          </div>
          {currentWeek.targetVolume && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Volume semaine</span>
                <span>
                  {(weekDuration / 60).toFixed(1)}h /{" "}
                  {currentWeek.targetVolume}h
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (weekDuration / 60 / currentWeek.targetVolume) * 100)}%`,
                    backgroundColor: PHASE_COLORS[currentWeek.phase],
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Durée semaine"
          value={(weekDuration / 60).toFixed(1)}
          unit="h"
          icon={Timer}
        />
        <StatCard
          label="Distance"
          value={weekDistance.toFixed(1)}
          unit="km"
          icon={Activity}
        />
        <StatCard
          label="Dénivelé"
          value={weekElevation}
          unit="m D+"
          icon={Mountain}
        />
        <StatCard
          label="RPE moyen"
          value={avgRPE.toFixed(1)}
          unit="/10"
          icon={Heart}
          color={avgRPE > 7 ? "text-red-400" : "text-brand-400"}
        />
      </div>

      {/* Fitness / Fatigue / Form chart */}
      {last60.length > 5 && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Fitness / Fatigue / Form (60 derniers jours)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={last60}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#6b7280" }}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="ctl"
                name="Fitness (CTL)"
                stroke="#4ade80"
                fill="#4ade8020"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="atl"
                name="Fatigue (ATL)"
                stroke="#f87171"
                fill="#f8717120"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="tsb"
                name="Form (TSB)"
                stroke="#38bdf8"
                fill="#38bdf820"
                strokeWidth={1}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Current form indicators */}
      {latestRolling && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <TrendingUp size={16} className="mx-auto text-green-400 mb-1" />
            <div className="text-xs text-gray-400">Fitness (CTL)</div>
            <div className="text-xl font-bold text-green-400">
              {latestRolling.ctl.toFixed(0)}
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <TrendingDown size={16} className="mx-auto text-red-400 mb-1" />
            <div className="text-xs text-gray-400">Fatigue (ATL)</div>
            <div className="text-xl font-bold text-red-400">
              {latestRolling.atl.toFixed(0)}
            </div>
          </div>
          <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
            <Activity size={16} className="mx-auto text-blue-400 mb-1" />
            <div className="text-xs text-gray-400">Form (TSB)</div>
            <div
              className={`text-xl font-bold ${latestRolling.tsb >= 0 ? "text-blue-400" : "text-orange-400"}`}
            >
              {latestRolling.tsb >= 0 ? "+" : ""}
              {latestRolling.tsb.toFixed(0)}
            </div>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="bg-yellow-950/30 rounded-xl border border-yellow-700/50 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-yellow-300">Alertes charge</h3>
          <ul className="list-disc ml-5 text-sm text-yellow-100 space-y-1">
            {alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent sessions */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 px-4 pt-4 pb-2">
          Dernières séances
        </h3>
        {sessions.length === 0 ? (
          <p className="text-gray-600 text-sm px-4 pb-4">
            Aucune séance enregistrée. Commence par en ajouter une !
          </p>
        ) : (
          <div className="divide-y divide-gray-800">
            {sessions
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map((s) => (
                <div
                  key={s.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {ACTIVITY_LABELS[s.type]}{" "}
                      <span className="text-gray-500 text-xs">{s.date}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.duration}min
                      {s.distance ? ` · ${s.distance}km` : ""}
                      {s.elevation ? ` · ${s.elevation}m D+` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {s.avgHR && (
                      <span className="text-red-400">{s.avgHR} bpm</span>
                    )}
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                        s.rpe >= 8
                          ? "bg-red-900/50 text-red-400"
                          : s.rpe >= 5
                            ? "bg-yellow-900/50 text-yellow-400"
                            : "bg-green-900/50 text-green-400"
                      }`}
                    >
                      RPE {s.rpe}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

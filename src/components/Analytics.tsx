import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { getProfile, getSessions } from "@/db";
import {
  aggregateDailyMetrics,
  computeRollingMetrics,
  computeTRIMP,
  computeSRPE,
  computeTSS,
} from "@/utils/metrics";
import type { Session } from "@/models/types";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#1f2937",
  border: "1px solid #374151",
  borderRadius: 8,
  fontSize: 12,
};

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">{title}</h3>
      {children}
    </div>
  );
}

type Granularity = "day" | "week" | "month";

function startOfWeekISO(dateISO: string): string {
  const date = new Date(dateISO);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function aggregateByGranularity(
  sessions: Session[],
  granularity: Granularity,
): Array<{
  key: string;
  label: string;
  distance: number;
  elevation: number;
  duration: number;
  sessionCount: number;
  avgRpe: number;
}> {
  const grouped = new Map<
    string,
    {
      distance: number;
      elevation: number;
      duration: number;
      sessionCount: number;
      rpeTotal: number;
    }
  >();

  for (const s of sessions) {
    const key =
      granularity === "day"
        ? s.date
        : granularity === "week"
          ? startOfWeekISO(s.date)
          : s.date.slice(0, 7);
    const existing = grouped.get(key) ?? {
      distance: 0,
      elevation: 0,
      duration: 0,
      sessionCount: 0,
      rpeTotal: 0,
    };
    existing.distance += s.distance ?? 0;
    existing.elevation += s.elevation ?? 0;
    existing.duration += s.duration;
    existing.sessionCount += 1;
    existing.rpeTotal += s.rpe;
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => ({
      key,
      label:
        granularity === "month"
          ? key
          : granularity === "week"
            ? `Sem. ${key.slice(5)}`
            : key.slice(5),
      distance: Number(data.distance.toFixed(2)),
      elevation: Math.round(data.elevation),
      duration: Math.round(data.duration),
      sessionCount: data.sessionCount,
      avgRpe: Number((data.rpeTotal / data.sessionCount).toFixed(2)),
    }));
}

export default function Analytics() {
  const sessions = useLiveQuery(() => getSessions()) ?? [];
  const profile = useLiveQuery(() => getProfile());
  const [granularity, setGranularity] = useState<Granularity>("week");

  if (!profile || sessions.length < 2) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Pas assez de données</p>
        <p className="text-sm mt-1">
          Enregistre au moins quelques séances pour voir les analytics.
        </p>
      </div>
    );
  }

  const dailyMetrics = aggregateDailyMetrics(sessions, profile);
  const rolling = computeRollingMetrics(dailyMetrics);

  // Weekly aggregation for bar charts
  const weeklyData = new Map<
    string,
    { trimp: number; srpe: number; tss: number; count: number }
  >();
  for (const s of sessions) {
    const d = new Date(s.date);
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const weekKey = monday.toISOString().slice(0, 10);
    const existing = weeklyData.get(weekKey) ?? {
      trimp: 0,
      srpe: 0,
      tss: 0,
      count: 0,
    };
    existing.trimp += computeTRIMP(s, profile);
    existing.srpe += computeSRPE(s);
    existing.tss += computeTSS(s, profile);
    existing.count++;
    weeklyData.set(weekKey, existing);
  }
  const weeklyArray = Array.from(weeklyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, data]) => ({ week: week.slice(5), ...data }));

  const volumeSeries = useMemo(
    () => aggregateByGranularity(sessions, granularity),
    [sessions, granularity],
  );

  // RPE distribution
  const rpeDist = Array.from({ length: 10 }, (_, i) => ({
    rpe: i + 1,
    count: sessions.filter((s) => s.rpe === i + 1).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Analytics</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-1 flex">
          {(
            [
              { value: "day", label: "Jour" },
              { value: "week", label: "Semaine" },
              { value: "month", label: "Mois" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setGranularity(option.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                granularity === option.value
                  ? "bg-brand-500 text-black font-semibold"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <ChartCard title="Distance (km)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={volumeSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar
              dataKey="distance"
              name="Distance (km)"
              fill="#4ade80"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Dénivelé (m D+)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={volumeSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar
              dataKey="elevation"
              name="Dénivelé (m D+)"
              fill="#38bdf8"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Durée (min)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={volumeSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar
              dataKey="duration"
              name="Durée (min)"
              fill="#fbbf24"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="RPE moyen">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={volumeSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#6b7280" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="avgRpe"
              name="RPE moyen"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Fitness / Fatigue / Form */}
      <ChartCard title="Fitness (CTL) / Fatigue (ATL) / Form (TSB)">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={rolling}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="ctl"
              name="Fitness"
              stroke="#4ade80"
              fill="#4ade8015"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="atl"
              name="Fatigue"
              stroke="#f87171"
              fill="#f8717115"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="tsb"
              name="Form"
              stroke="#38bdf8"
              fill="#38bdf815"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Weekly TSS */}
      <ChartCard title="Charge hebdomadaire (TSS)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={weeklyArray}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar
              dataKey="tss"
              name="TSS"
              fill="#4ade80"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Monotony & Strain */}
      <ChartCard title="Monotonie & Strain (Foster)">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={rolling.slice(-90)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickFormatter={(d: string) => d.slice(5)}
            />
            <YAxis yAxisId="mono" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis
              yAxisId="strain"
              orientation="right"
              tick={{ fontSize: 10, fill: "#6b7280" }}
            />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              yAxisId="mono"
              type="monotone"
              dataKey="monotony"
              name="Monotonie"
              stroke="#fbbf24"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="strain"
              type="monotone"
              dataKey="strain"
              name="Strain"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-600 mt-2">
          Monotonie &gt; 2.0 = risque de surentraînement. Strain élevé +
          monotonie élevée = zone rouge.
        </p>
      </ChartCard>

      {/* Weekly sRPE */}
      <ChartCard title="Charge subjective hebdo (sRPE)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyArray}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar
              dataKey="srpe"
              name="sRPE"
              fill="#38bdf8"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* RPE distribution */}
      <ChartCard title="Distribution RPE">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={rpeDist}>
            <XAxis dataKey="rpe" tick={{ fontSize: 10, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar
              dataKey="count"
              name="Séances"
              fill="#a78bfa"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-gray-600 mt-2">
          Distribution 80/20 recommandée : majorité RPE 2-4, minorité RPE 7-9.
        </p>
      </ChartCard>
    </div>
  );
}

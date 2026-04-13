import type { ActivityType, Session } from "@/models/types";

type SessionInput = Omit<Session, "id">;

const DATE_HEADERS = [
  "activitydate",
  "date",
  "startdate",
  "datedelactivite",
  "dateactivite",
];
const TYPE_HEADERS = ["activitytype", "sporttype", "type", "typedactivite"];
const DISTANCE_HEADERS = ["distance", "distancekm"];
const DURATION_HEADERS = [
  "movingtime",
  "elapsedtime",
  "duration",
  "tempsdedeplacement",
  "duree",
];
const ELEVATION_HEADERS = [
  "elevationgain",
  "totalelevationgain",
  "elevation",
  "denivelepositif",
  "d",
];
const AVG_HR_HEADERS = ["averageheartrate", "heartrate", "avghr", "fcmoyenne"];
const MAX_HR_HEADERS = ["maxheartrate", "maxhr", "fcmax"];
const NAME_HEADERS = ["activityname", "name", "nom", "titre"];

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];
  return (
    candidates
      .map((delimiter) => ({
        delimiter,
        count: firstLine.split(delimiter).length,
      }))
      .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ","
  );
}

function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const compact = trimmed.replace(/\s+/g, "");
  const normalized =
    compact.includes(",") && !compact.includes(".")
      ? compact.replace(/,/g, ".")
      : compact.replace(/,/g, "");
  const cleaned = normalized.replace(/[^0-9.-]/g, "");
  if (!cleaned) return undefined;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function toDurationMinutes(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (!v) return undefined;

  const hhmmss = v.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hhmmss) {
    const a = Number(hhmmss[1]);
    const b = Number(hhmmss[2]);
    const c = Number(hhmmss[3] ?? 0);
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c)) {
      if (hhmmss[3] !== undefined)
        return Math.round((a * 3600 + b * 60 + c) / 60);
      return Math.round((a * 60 + b) / 60);
    }
  }

  const textual = v.match(/(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/i);
  if (textual && (textual[1] || textual[2] || textual[3])) {
    const h = Number(textual[1] ?? 0);
    const m = Number(textual[2] ?? 0);
    const s = Number(textual[3] ?? 0);
    return Math.max(1, Math.round((h * 3600 + m * 60 + s) / 60));
  }

  const number = toNumber(v);
  if (number === undefined) return undefined;
  if (number > 1440) return Math.max(1, Math.round(number / 60)); // seconds
  return Math.max(1, Math.round(number)); // minutes
}

function toISODate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const frMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (frMatch) {
    const d = frMatch[1]!.padStart(2, "0");
    const m = frMatch[2]!.padStart(2, "0");
    return `${frMatch[3]}-${m}-${d}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function mapActivityType(value: string | undefined): ActivityType {
  const t = (value ?? "").trim().toLowerCase();
  if (t.includes("trail")) return "trail";
  if (
    t.includes("run") ||
    t.includes("course") ||
    t.includes("jog") ||
    t.includes("treadmill")
  ) {
    return "road_run";
  }
  if (
    t.includes("ride") ||
    t.includes("bike") ||
    t.includes("cycl") ||
    t.includes("velo")
  ) {
    return "bike";
  }
  if (t.includes("hike") || t.includes("rand")) return "hike";
  if (t.includes("strength") || t.includes("muscu") || t.includes("workout")) {
    return "strength";
  }
  return "other";
}

function defaultRpe(type: ActivityType): number {
  if (type === "strength") return 6;
  if (type === "trail" || type === "road_run") return 5;
  if (type === "bike" || type === "hike") return 4;
  return 5;
}

function pickValue(
  row: Record<string, string>,
  headers: string[],
): string | undefined {
  for (const h of headers) {
    const value = row[h];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

export function parseActivitiesCsv(text: string): SessionInput[] {
  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, delimiter);
  if (rows.length < 2) return [];

  const headers = rows[0]!.map(normalizeHeader);
  const dataRows = rows.slice(1);
  const sessions: SessionInput[] = [];

  for (const values of dataRows) {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    const date = toISODate(pickValue(row, DATE_HEADERS));
    const duration = toDurationMinutes(pickValue(row, DURATION_HEADERS));
    if (!date || !duration) continue;

    const type = mapActivityType(pickValue(row, TYPE_HEADERS));
    const distanceRaw = toNumber(pickValue(row, DISTANCE_HEADERS));
    const elevationRaw = toNumber(pickValue(row, ELEVATION_HEADERS));
    const avgHR = toNumber(pickValue(row, AVG_HR_HEADERS));
    const maxHR = toNumber(pickValue(row, MAX_HR_HEADERS));
    const name = pickValue(row, NAME_HEADERS);

    const distance =
      distanceRaw !== undefined
        ? distanceRaw > 300
          ? Number((distanceRaw / 1000).toFixed(2))
          : Number(distanceRaw.toFixed(2))
        : undefined;

    sessions.push({
      date,
      type,
      duration,
      distance,
      elevation:
        elevationRaw !== undefined ? Math.round(elevationRaw) : undefined,
      avgHR: avgHR !== undefined ? Math.round(avgHR) : undefined,
      maxHR: maxHR !== undefined ? Math.round(maxHR) : undefined,
      rpe: defaultRpe(type),
      notes: name ? name.slice(0, 1000) : undefined,
    });
  }

  return sessions;
}

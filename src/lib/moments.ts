import { CITIES } from "./catalog";
import type { Moment } from "./state";
import { inRange, validZone } from "./time";

export interface SavedMoment extends Moment {
  id: string;
  title: string;
  trails: boolean;
  labels: boolean;
}
export interface StarterSky extends Moment {
  title: string;
  description: string;
  trails: boolean;
}
export const STARTER_SKIES: StarterSky[] = [
  {
    title: "Winter lights",
    description:
      "Find Sirius, Orion’s two bright stars and the amber eye of Taurus.",
    place: CITIES[0],
    ms: Date.parse("2026-01-15T19:00:00Z"),
    trails: false,
  },
  {
    title: "A southern sky",
    description:
      "Visit Sydney. Polaris stays out of sight while other familiar stars cross the sky.",
    place: CITIES.find((p) => p.label === "Sydney")!,
    ms: Date.parse("2026-01-15T11:00:00Z"),
    trails: true,
  },
  {
    title: "A lingering dusk",
    description:
      "Near midsummer in Reykjavík, watch how shallowly the Sun dips below the horizon.",
    place: CITIES.find((p) => p.label === "Reykjavík")!,
    ms: Date.parse("2026-06-21T00:00:00Z"),
    trails: false,
  },
];
export const MOMENTS_KEY = "maps-to-the-stars.moments.v1";
export const MOMENT_LIMIT = 50;
type ShelfStorage = Pick<Storage, "getItem" | "setItem">;

function isSavedMoment(value: unknown): value is SavedMoment {
  if (!value || typeof value !== "object") return false;
  const v = value as SavedMoment;
  const p = v.place;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    v.id.length <= 100 &&
    typeof v.title === "string" &&
    v.title.trim().length > 0 &&
    v.title.length <= 60 &&
    typeof v.ms === "number" &&
    Number.isSafeInteger(v.ms) &&
    typeof v.trails === "boolean" &&
    typeof v.labels === "boolean" &&
    !!p &&
    typeof p.label === "string" &&
    p.label.length <= 100 &&
    typeof p.country === "string" &&
    p.country.length <= 100 &&
    typeof p.lat === "number" &&
    Number.isFinite(p.lat) &&
    Math.abs(p.lat) <= 90 &&
    typeof p.lon === "number" &&
    Number.isFinite(p.lon) &&
    Math.abs(p.lon) <= 180 &&
    typeof p.zone === "string" &&
    validZone(p.zone) &&
    inRange(v.ms, p.zone)
  );
}

export function readSavedMoments(storage?: ShelfStorage): {
  moments: SavedMoment[];
  warning?: string;
} {
  try {
    const raw = (storage ?? window.localStorage).getItem(MOMENTS_KEY);
    if (!raw) return { moments: [] };
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.moments)) throw Error();
    const seen = new Set<string>();
    const moments = data.moments
      .filter((entry: unknown): entry is SavedMoment => {
        if (!isSavedMoment(entry) || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      })
      .slice(0, MOMENT_LIMIT);
    return {
      moments,
      warning:
        moments.length === data.moments.length
          ? undefined
          : "Some saved skies could not be read. Your valid Moments are still available.",
    };
  } catch {
    return {
      moments: [],
      warning:
        "Saved Moments could not be read on this device. You can still explore and download a sky card.",
    };
  }
}

export function writeSavedMoments(
  moments: SavedMoment[],
  storage?: ShelfStorage,
) {
  if (
    moments.length > MOMENT_LIMIT ||
    !moments.every(isSavedMoment) ||
    new Set(moments.map((m) => m.id)).size !== moments.length
  )
    throw Error("Invalid Moments collection.");
  (storage ?? window.localStorage).setItem(
    MOMENTS_KEY,
    JSON.stringify({ version: 1, moments }),
  );
}

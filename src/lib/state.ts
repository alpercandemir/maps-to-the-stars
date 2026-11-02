import { CITIES, type Place } from "./catalog";
import { inRange, validZone } from "./time";
export interface Moment {
  place: Place;
  ms: number;
}
export const DEFAULT_PLACE = CITIES[0];
export function defaultMoment(): Moment {
  return {
    place: {
      ...DEFAULT_PLACE,
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    ms: Date.now(),
  };
}
export function readMoment(search: string): {
  moment: Moment;
  isDefault: boolean;
  warning?: string;
} {
  const p = new URLSearchParams(search);
  if (!["lat", "lon", "tz", "at", "place"].some((key) => p.has(key)))
    return { moment: defaultMoment(), isDefault: true };
  const lat = Number(p.get("lat")),
    lon = Number(p.get("lon")),
    zone = p.get("tz") || "";
  const at = p.get("at") || "";
  const ms = Date.parse(at);
  if (
    !p.get("lat")?.trim() ||
    !p.get("lon")?.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180 ||
    !validZone(zone) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(at) ||
    !inRange(ms, zone) ||
    new Date(ms).toISOString().slice(0, 19) !== at.slice(0, 19)
  ) {
    return {
      moment: defaultMoment(),
      isDefault: true,
      warning:
        "This link contains an invalid moment. Showing our default Istanbul sky.",
    };
  }
  const city = CITIES.find(
    (city) => city.lat === lat && city.lon === lon && city.zone === zone,
  );
  return {
    isDefault: false,
    moment: {
      place: {
        lat,
        lon,
        zone,
        label: (p.get("place") || "Selected coordinates").slice(0, 100),
        country: city?.country || "",
      },
      ms,
    },
  };
}
export function shareURL(moment: Moment, base: string) {
  const u = new URL(base);
  u.search = "";
  u.hash = "";
  for (const [k, v] of Object.entries({
    lat: String(moment.place.lat),
    lon: String(moment.place.lon),
    tz: moment.place.zone,
    place: moment.place.label,
    at: new Date(moment.ms).toISOString(),
  }))
    u.searchParams.set(k, v);
  return u.toString();
}

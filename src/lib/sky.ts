import {
  Body,
  DefineStar,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchHourAngle,
} from "astronomy-engine";
import { STARS, type Place } from "./catalog";

for (const star of STARS)
  DefineStar(star.body, star.ra, star.dec, star.distance);
export interface SkyObject {
  id: string;
  body: Body;
  name: string;
  constellation: string;
  magnitude: number;
  color: string;
  description: string;
  altitude: number;
  azimuth: number;
  dec: number;
  distance?: number;
  phase?: number;
  fraction?: number;
}
export function position(body: Body, ms: number, place: Place) {
  const date = new Date(ms),
    observer = new Observer(place.lat, place.lon, 0);
  const eq = Equator(body, date, observer, true, true);
  // No refraction: visibility is strictly above the geometric horizon.
  const horizontal = Horizon(date, observer, eq.ra, eq.dec);
  return {
    altitude: horizontal.altitude,
    azimuth: horizontal.azimuth,
    dec: eq.dec,
  };
}
export function calculateSky(ms: number, place: Place): SkyObject[] {
  const stars: SkyObject[] = STARS.map((s) => ({
    ...s,
    ...position(s.body, ms, place),
  }));
  const date = new Date(ms);
  return [
    ...stars,
    {
      id: "moon",
      body: Body.Moon,
      name: "Moon",
      constellation: "Earth’s companion",
      magnitude: Illumination(Body.Moon, date).mag,
      color: "#eddfbb",
      description:
        "A familiar companion, seen from a different moment. Its sunlit shape changes as it travels around Earth.",
      ...position(Body.Moon, ms, place),
      phase: MoonPhase(date),
      fraction: Illumination(Body.Moon, date).phase_fraction,
    },
  ];
}
// Azimuthal equidistant: zenith in centre, N up, E right. Radius is linear in zenith angle.
export function project(
  azimuth: number,
  altitude: number,
  radius = 250,
  center = 320,
) {
  const r = (radius * (90 - altitude)) / 90,
    a = (azimuth * Math.PI) / 180;
  return { x: center + r * Math.sin(a), y: center - r * Math.cos(a) };
}
export function starRadius(magnitude: number) {
  return 1.6 + 1.8 * Math.pow(10, -0.2 * magnitude);
}
export function compass(azimuth: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round((((azimuth % 360) + 360) % 360) / 45) % 8
  ];
}
export function phaseName(phase: number) {
  if (phase < 8 || phase > 352) return "New moon";
  if (phase < 82) return "Waxing crescent";
  if (phase < 98) return "First quarter";
  if (phase < 172) return "Waxing gibbous";
  if (phase < 188) return "Full moon";
  if (phase < 262) return "Waning gibbous";
  if (phase < 278) return "Last quarter";
  return "Waning crescent";
}
export interface Events {
  status: "normal" | "always-up" | "always-down";
  rise?: number;
  set?: number;
  transit?: number;
}
export function events(body: Body, ms: number, place: Place): Events {
  const observer = new Observer(place.lat, place.lon, 0);
  const dec = position(body, ms, place).dec;
  const min = Math.abs(place.lat + dec) - 90;
  const max = 90 - Math.abs(place.lat - dec);
  const status =
    body !== Body.Moon && min > 0
      ? "always-up"
      : body !== Body.Moon && max < 0
        ? "always-down"
        : "normal";
  const result: Events = { status };
  // Scan the coming 48h and refine sign crossings to < 1 second.
  // Unlike refracted rise/set APIs, these events match our geometric centre horizon.
  if (status === "normal") {
    let before = ms,
      beforeAlt = position(body, before, place).altitude;
    const step = 10 * 60_000;
    for (let after = ms + step; after <= ms + 48 * 3600_000; after += step) {
      const afterAlt = position(body, after, place).altitude;
      if (
        (beforeAlt < 0 && afterAlt >= 0) ||
        (beforeAlt >= 0 && afterAlt < 0)
      ) {
        let low = before,
          high = after;
        const rising = afterAlt > beforeAlt;
        while (high - low > 500) {
          const mid = (low + high) / 2;
          if (position(body, mid, place).altitude >= 0 === rising) high = mid;
          else low = mid;
        }
        // Land after the crossing so the map agrees with the event we jumped to.
        if (rising && !result.rise) result.rise = Math.ceil(high);
        if (!rising && !result.set) result.set = Math.ceil(high);
        if (result.rise && result.set) break;
      }
      before = after;
      beforeAlt = afterAlt;
    }
  }
  // Upper meridian passage. Near geographic poles, altitude may barely change.
  result.transit = SearchHourAngle(
    body,
    observer,
    0,
    new Date(ms),
    1,
  ).time.date.getTime();
  return result;
}

import { STARS, type Place } from "./catalog";
import { position, project, type SkyObject } from "./sky";

export const TRAIL_DURATION = 2 * 3600_000;
const STEP = 5 * 60_000;
type Point = ReturnType<typeof project> & { altitude: number };
export interface StarTrail {
  id: string;
  color: string;
  segments: { from: Point; to: Point; opacity: number }[];
}

// A fixed time grid makes trails independent of playback history. Keep only the
// current window in memory; neighbouring frames reuse the astronomical samples.
export function createStarTrailSampler(place: Place) {
  const cache = new Map<number, Point[]>();
  return (ms: number, currentSky: SkyObject[]): StarTrail[] => {
    const start = ms - TRAIL_DURATION;
    const first = Math.floor(start / STEP) * STEP;
    for (const time of cache.keys()) {
      if (time < first || time > ms) cache.delete(time);
    }
    const samples: { ms: number; points: Point[] }[] = [];
    for (let time = first; time < ms; time += STEP) {
      let points = cache.get(time);
      if (!points) {
        points = STARS.map((star) => {
          const p = position(star.body, time, place);
          return { ...project(p.azimuth, p.altitude), altitude: p.altitude };
        });
        cache.set(time, points);
      }
      samples.push({ ms: time, points });
    }
    samples.push({
      ms,
      points: STARS.map((star) => {
        const p = currentSky.find((object) => object.id === star.id)!;
        return { ...project(p.azimuth, p.altitude), altitude: p.altitude };
      }),
    });
    return STARS.map((star, index) => {
      const segments: StarTrail["segments"] = [];
      for (let i = 1; i < samples.length; i++) {
        const before = samples[i - 1];
        const after = samples[i];
        let from = before.points[index];
        const to = after.points[index];
        if (from.altitude < 0 && to.altitude < 0) continue;
        // Trim the oldest segment to exactly two hours. Linear interpolation is
        // also the SVG polyline approximation between the calculated samples.
        if (before.ms < start) {
          const f = (start - before.ms) / (after.ms - before.ms);
          from = {
            x: from.x + (to.x - from.x) * f,
            y: from.y + (to.y - from.y) * f,
            altitude: from.altitude + (to.altitude - from.altitude) * f,
          };
        }
        if (from.altitude < 0 && to.altitude < 0) continue;
        const age =
          (ms - (Math.max(start, before.ms) + after.ms) / 2) / TRAIL_DURATION;
        segments.push({ from, to, opacity: 0.32 * (1 - age) ** 1.5 });
      }
      return { id: star.id, color: star.color, segments };
    });
  };
}

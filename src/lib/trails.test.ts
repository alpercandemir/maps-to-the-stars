import { describe, expect, it } from "vitest";
import { CITIES } from "./catalog";
import { calculateSky, events, project } from "./sky";
import { createStarTrailSampler, TRAIL_DURATION } from "./trails";
import { Body } from "astronomy-engine";

const place = CITIES[0];
const instant = Date.parse("1998-07-15T20:32:00Z");

describe("two-hour star trails", () => {
  it("fades toward the past and ends at the calculated current star", () => {
    const sky = calculateSky(instant, place);
    const trails = createStarTrailSampler(place)(instant, sky);
    expect(trails).toHaveLength(8);
    expect(trails.some((trail) => trail.id === "moon")).toBe(false);
    const polaris = trails.find((trail) => trail.id === "polaris")!;
    const current = sky.find((object) => object.id === "polaris")!;
    expect(polaris.segments.at(-1)!.to).toMatchObject(
      project(current.azimuth, current.altitude),
    );
    for (let i = 1; i < polaris.segments.length; i++) {
      expect(polaris.segments[i].opacity).toBeGreaterThan(
        polaris.segments[i - 1].opacity,
      );
    }
    // The oldest endpoint is trimmed inside the fixed five-minute sample grid.
    const before = calculateSky(instant - TRAIL_DURATION - 2 * 60000, place)[0];
    const after = calculateSky(instant - TRAIL_DURATION + 3 * 60000, place)[0];
    const a = project(before.azimuth, before.altitude);
    const b = project(after.azimuth, after.altitude);
    expect(polaris.segments[0].from.x).toBeCloseTo(a.x + (b.x - a.x) * 0.4);
    expect(polaris.segments[0].from.y).toBeCloseTo(a.y + (b.y - a.y) * 0.4);
  });

  it("restores identical trails after forward playback, backward scrubbing and jumps", () => {
    const sample = createStarTrailSampler(place);
    const original = sample(instant, calculateSky(instant, place));
    for (const offset of [60000, 20 * 60000, -3600_000, 180 * 24 * 3600_000]) {
      const ms = instant + offset;
      sample(ms, calculateSky(ms, place));
      expect(sample(instant, calculateSky(instant, place))).toEqual(original);
    }
    expect(
      createStarTrailSampler(place)(instant, calculateSky(instant, place)),
    ).toEqual(original);
  });

  it("retains the visible past of a setting star and omits never-visible stars", () => {
    const setting = events(Body.Star3, instant, place).set! + 10 * 60000;
    const sky = calculateSky(setting, place);
    expect(sky.find((object) => object.id === "vega")!.altitude).toBeLessThan(
      0,
    );
    const vega = createStarTrailSampler(place)(setting, sky).find(
      (trail) => trail.id === "vega",
    )!;
    expect(vega.segments.length).toBeGreaterThan(0);
    for (const segment of vega.segments) {
      expect(segment.from.altitude >= 0 || segment.to.altitude >= 0).toBe(true);
    }
    const sydney = CITIES.find((city) => city.label === "Sydney")!;
    const southern = createStarTrailSampler(sydney)(
      instant,
      calculateSky(instant, sydney),
    );
    expect(southern.find((trail) => trail.id === "polaris")!.segments).toEqual(
      [],
    );
  });
});

import { describe, expect, it } from "vitest";
import { Body } from "astronomy-engine";
import { CITIES, STARS } from "./catalog";
import {
  calculateSky,
  compass,
  events,
  position,
  project,
  starRadius,
} from "./sky";
import reference from "./__fixtures__/pyephem.json";
const istanbul = CITIES[0];
const example = Date.parse("1998-07-15T20:30:00Z");
function separation(
  a: { altitude: number; azimuth: number },
  b: { altitude: number; azimuth: number },
) {
  const r = Math.PI / 180;
  const dot =
    Math.sin(a.altitude * r) * Math.sin(b.altitude * r) +
    Math.cos(a.altitude * r) *
      Math.cos(b.altitude * r) *
      Math.cos((a.azimuth - b.azimuth) * r);
  return Math.acos(Math.max(-1, Math.min(1, dot))) / r;
}
describe("independent PyEphem/libastro comparison", () => {
  for (const sample of reference.cases) {
    it(sample.label + ": eight stars and the Moon within 0.08°", () => {
      const sky = calculateSky(Date.parse(sample.instant), sample.place);
      for (const expected of sample.objects) {
        const actual = sky.find((o) => o.id === expected.id)!;
        expect(
          separation(actual, expected),
          `${sample.label} ${actual.name}`,
        ).toBeLessThan(0.08);
        if (expected.fraction !== undefined)
          expect(Math.abs(actual.fraction! - expected.fraction)).toBeLessThan(
            0.005,
          );
      }
    });
  }
});
describe("geometric sky and events", () => {
  it.each([CITIES[0], CITIES[10], CITIES[12]])(
    "event jumps land on the post-crossing side in $label",
    (place) => {
      for (const body of [...STARS.map((star) => star.body), Body.Moon]) {
        const result = events(body, example, place);
        if (result.rise !== undefined) {
          expect(
            position(body, result.rise, place).altitude,
          ).toBeGreaterThanOrEqual(0);
          expect(
            position(body, result.rise - 501, place).altitude,
          ).toBeLessThan(0);
        }
        if (result.set !== undefined) {
          expect(position(body, result.set, place).altitude).toBeLessThan(0);
          expect(
            position(body, result.set - 501, place).altitude,
          ).toBeGreaterThanOrEqual(0);
        }
      }
    },
  );
  it("Polaris circles close to geographic north, never rises/sets in Istanbul", () => {
    for (let h = 0; h < 24; h += 2) {
      const p = position(Body.Star1, example + h * 3600_000, istanbul);
      expect(Math.abs(p.altitude - istanbul.lat)).toBeLessThan(1);
      expect(Math.min(p.azimuth, 360 - p.azimuth)).toBeLessThan(1.5);
    }
    const e = events(Body.Star1, example, istanbul);
    expect(e.status).toBe("always-up");
    expect(e.rise).toBeUndefined();
    expect(e.set).toBeUndefined();
  });
  it("Polaris stays below the horizon in Sydney", () => {
    expect(
      events(
        Body.Star1,
        example,
        CITIES.find((p) => p.label === "Sydney")!,
      ).status,
    ).toBe("always-down");
  });
  it("Sirius is below the horizon on the example summer night", () => {
    expect(position(Body.Star2, example, istanbul).altitude).toBeLessThan(0);
  });
  it("objects move when time or location changes", () => {
    const p = position(Body.Star3, example, istanbul);
    expect(
      separation(p, position(Body.Star3, example + 6 * 3600_000, istanbul)),
    ).toBeGreaterThan(20);
    expect(
      separation(
        p,
        position(
          Body.Star3,
          example,
          CITIES.find((p) => p.label === "Sydney")!,
        ),
      ),
    ).toBeGreaterThan(20);
  });
  it("rise/set straddle zero unrefracted centre altitude in the correct direction", () => {
    const e = events(Body.Star3, example, istanbul);
    for (const [instant, rising] of [
      [e.rise!, true],
      [e.set!, false],
    ] as const) {
      expect(instant).toBeGreaterThan(example);
      expect(
        Math.abs(position(Body.Star3, instant, istanbul).altitude),
      ).toBeLessThan(0.003);
      expect(
        position(Body.Star3, instant + 60000, istanbul).altitude >
          position(Body.Star3, instant - 60000, istanbul).altitude,
      ).toBe(rising);
    }
    const t = e.transit!;
    expect(position(Body.Star3, t, istanbul).altitude).toBeGreaterThan(
      position(Body.Star3, t - 20 * 60000, istanbul).altitude,
    );
    expect(position(Body.Star3, t, istanbul).altitude).toBeGreaterThan(
      position(Body.Star3, t + 20 * 60000, istanbul).altitude,
    );
  });
  it("bright stars remain larger than dimmer ones", () => {
    expect(starRadius(-1.46)).toBeGreaterThan(starRadius(0.03));
    expect(starRadius(0.03)).toBeGreaterThan(starRadius(1.98));
  });
});
describe("north-up, east-right azimuthal equidistant projection", () => {
  it.each([
    [0, 320, 70],
    [90, 570, 320],
    [180, 320, 570],
    [270, 70, 320],
  ])("horizon azimuth %s", (a, x, y) => {
    const p = project(a, 0);
    expect(p.x).toBeCloseTo(x);
    expect(p.y).toBeCloseTo(y);
  });
  it("zenith is centre at every azimuth", () => {
    for (const a of [0, 42, 359])
      expect(project(a, 90)).toEqual({ x: 320, y: 320 });
  });
  it("wraps smoothly around north", () => {
    const a = project(359, 45),
      b = project(1, 45);
    expect(a.y).toBeCloseTo(b.y);
    expect(Math.abs(a.x - b.x)).toBeLessThan(5);
  });
  it("uses correct wrapped compass directions", () => {
    expect(compass(359)).toBe("N");
    expect(compass(90)).toBe("E");
    expect(compass(-1)).toBe("N");
  });
});

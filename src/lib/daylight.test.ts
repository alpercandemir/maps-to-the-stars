import { describe, expect, it } from "vitest";
import { lightAtAltitude, solarContext } from "./daylight";
import { CITIES } from "./catalog";
import { STARTER_SKIES } from "./moments";
import { calculateSky } from "./sky";

describe("solar context", () => {
  it.each([
    [20, "day"],
    [0, "day"],
    [-0.001, "civil"],
    [-6, "civil"],
    [-6.001, "nautical"],
    [-12, "nautical"],
    [-12.001, "astronomical"],
    [-18, "astronomical"],
    [-18.001, "night"],
  ] as const)(
    "classifies geometric solar altitude %s as %s",
    (altitude, band) => {
      expect(lightAtAltitude(altitude).band).toBe(band);
    },
  );
  it("keeps the tint continuous across twilight labels", () => {
    for (const altitude of [-18, -12, -6, 0, 30]) {
      expect(lightAtAltitude(altitude - 0.00001).tint).toBe(
        lightAtAltitude(altitude + 0.00001).tint,
      );
    }
  });
  it("calculates day and night from the instant and observer rather than wall-clock labels", () => {
    expect(
      solarContext(Date.parse("2026-01-15T10:00:00Z"), CITIES[0]).band,
    ).toBe("day");
    expect(
      solarContext(Date.parse("2026-01-15T22:00:00Z"), CITIES[0]).band,
    ).toBe("night");
    const pole = { ...CITIES[0], lat: 90, lon: 0 };
    expect(solarContext(Date.parse("2026-06-21T00:00:00Z"), pole).band).toBe(
      "day",
    );
    expect(solarContext(Date.parse("2026-12-21T12:00:00Z"), pole).band).toBe(
      "night",
    );
  });
  it("curated skies actually demonstrate their advertised patterns", () => {
    const winter = STARTER_SKIES[0];
    const sky = calculateSky(winter.ms, winter.place);
    for (const id of ["sirius", "betelgeuse", "rigel", "aldebaran"])
      expect(sky.find((o) => o.id === id)!.altitude).toBeGreaterThan(0);
    const south = STARTER_SKIES[1];
    expect(
      calculateSky(south.ms, south.place).find((o) => o.id === "polaris")!
        .altitude,
    ).toBeLessThan(0);
    const dusk = STARTER_SKIES[2];
    expect(solarContext(dusk.ms, dusk.place).band).toBe("civil");
  });
});

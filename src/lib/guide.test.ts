import { describe, expect, it } from "vitest";
import {
  absoluteAngles,
  deviceView,
  manualView,
  projectInView,
  viewDirection,
  type CompassEvent,
} from "./guide";

describe("rear-camera sky projection", () => {
  it.each([0, 90, 180, 270])(
    "centres the intended compass direction %s",
    (heading) => {
      const p = projectInView(heading, 35, manualView(heading, 35), 0.75)!;
      expect(p.x).toBeCloseTo(50);
      expect(p.y).toBeCloseTo(50);
      expect(p.visible).toBe(true);
      expect(
        projectInView(heading + 180, -35, manualView(heading, 35), 0.75),
      ).toBeNull();
    },
  );
  it("puts east to the right and higher objects above the centre when looking north", () => {
    const v = manualView(0, 0);
    expect(projectInView(10, 0, v, 1)!.x).toBeGreaterThan(50);
    expect(projectInView(0, 10, v, 1)!.y).toBeLessThan(50);
    expect(projectInView(60, 0, v, 1)!.visible).toBe(false);
  });
  it.each([
    [0, 0],
    [270, 90],
    [180, 180],
    [90, 270],
  ])(
    "uses W3C alpha %s as heading %s for an upright rear camera",
    (alpha, azimuth) => {
      const v = deviceView(alpha, 90, 0);
      expect(viewDirection(v).azimuth).toBeCloseTo(azimuth);
      expect(viewDirection(v).altitude).toBeCloseTo(0);
      expect(projectInView(azimuth, 0, v, 1)!.x).toBeCloseTo(50);
    },
  );
  it("preserves tilt, screen rotation, and compass correction", () => {
    expect(viewDirection(deviceView(0, 135, 0)).altitude).toBeCloseTo(45);
    expect(viewDirection(deviceView(0, 90, 0, 0, 20)).azimuth).toBeCloseTo(20);
    const landscape = projectInView(0, 10, deviceView(0, 90, 0, 90), 1)!;
    expect(landscape.x).toBeLessThan(50);
    expect(landscape.y).toBeCloseTo(50);
  });
  it("rejects relative and invalid readings; accepts absolute and Safari compass data", () => {
    const e = {
      type: "deviceorientation",
      alpha: 45,
      beta: 90,
      gamma: 0,
      absolute: false,
    };
    expect(absoluteAngles(e as CompassEvent)).toBeNull();
    expect(
      absoluteAngles({ ...e, absolute: true } as CompassEvent)?.alpha,
    ).toBe(45);
    expect(
      absoluteAngles({
        ...e,
        alpha: null,
        webkitCompassHeading: 90,
        webkitCompassAccuracy: 5,
      } as unknown as CompassEvent)?.alpha,
    ).toBe(270);
    expect(
      absoluteAngles({
        ...e,
        alpha: null,
        webkitCompassHeading: 90,
        webkitCompassAccuracy: -1,
      } as unknown as CompassEvent),
    ).toBeNull();
    expect(
      absoluteAngles({ ...e, absolute: true, beta: NaN } as CompassEvent),
    ).toBeNull();
  });
});

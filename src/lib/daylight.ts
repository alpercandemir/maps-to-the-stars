import { Body } from "astronomy-engine";
import type { Place } from "./catalog";
import { position } from "./sky";

export function lightAtAltitude(altitude: number) {
  const band =
    altitude >= 0
      ? "day"
      : altitude >= -6
        ? "civil"
        : altitude >= -12
          ? "nautical"
          : altitude >= -18
            ? "astronomical"
            : "night";
  const labels = {
    day: "Daylight",
    civil: "Civil twilight",
    nautical: "Nautical twilight",
    astronomical: "Astronomical twilight",
    night: "Night",
  };
  // Interpolate the illustrative tint continuously, including across band edges.
  const stops = [
    { altitude: -18, color: [25, 38, 55] },
    { altitude: -12, color: [41, 44, 75] },
    { altitude: -6, color: [83, 61, 78] },
    { altitude: 0, color: [63, 94, 124] },
    { altitude: 30, color: [65, 115, 155] },
  ];
  const a = Math.max(-18, Math.min(30, altitude));
  const upper = stops.findIndex((stop) => stop.altitude >= a);
  const before = stops[Math.max(0, upper - 1)];
  const after = stops[upper];
  const f =
    after.altitude === before.altitude
      ? 0
      : (a - before.altitude) / (after.altitude - before.altitude);
  const color = before.color.map((channel, i) =>
    Math.round(channel + (after.color[i] - channel) * f),
  );
  return {
    altitude,
    band,
    label: labels[band],
    tint: `rgb(${color.join(", ")})`,
    description:
      band === "day"
        ? "Daylight can hide these stars from view."
        : band === "night"
          ? "Sun more than 18° below the horizon. Visibility still depends on local conditions."
          : "Sunlight still brightens the sky. Stars remain plotted at their calculated positions.",
  };
}

export type SolarContext = ReturnType<typeof lightAtAltitude>;
export function solarContext(ms: number, place: Place): SolarContext {
  return lightAtAltitude(position(Body.Sun, ms, place).altitude);
}

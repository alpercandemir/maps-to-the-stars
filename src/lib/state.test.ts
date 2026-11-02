import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLACE, readMoment, shareURL } from "./state";

const DEFAULT = {
  place: DEFAULT_PLACE,
  ms: Date.parse("2026-11-02T01:30:00Z"),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(DEFAULT.ms);
});
afterEach(() => vi.useRealTimers());

describe("shareable moments", () => {
  it("starts in Istanbul at the current instant in the user's time zone", () => {
    const { moment, warning } = readMoment("");
    expect(warning).toBeUndefined();
    expect(moment).toEqual({
      place: {
        ...DEFAULT_PLACE,
        label: "Istanbul",
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      ms: Date.now(),
    });
    vi.setSystemTime(DEFAULT.ms + 60_000);
    expect(readMoment("?unrelated=yes").moment.ms).toBe(Date.now());
  });
  it("reproduces the instant, coordinates, label and IANA zone from URL alone", () => {
    const url = shareURL(DEFAULT, "https://example.com/sky?unrelated=yes#old");
    const { moment, warning } = readMoment(new URL(url).search);
    expect(warning).toBeUndefined();
    expect(moment.ms).toBe(DEFAULT.ms);
    expect(moment.place.lat).toBe(DEFAULT.place.lat);
    expect(moment.place.lon).toBe(DEFAULT.place.lon);
    expect(moment.place.label).toBe(DEFAULT.place.label);
    expect(moment.place.zone).toBe(DEFAULT.place.zone);
    expect(new URL(url).hash).toBe("");
  });
  it("preserves sub-second timestamps and coordinates without rounding", () => {
    const m = {
      place: { ...DEFAULT.place, lat: -33.86881234 },
      ms: DEFAULT.ms + 123,
    };
    expect(
      readMoment(new URL(shareURL(m, "https://example.com")).search).moment.ms,
    ).toBe(m.ms);
    expect(
      readMoment(new URL(shareURL(m, "https://example.com")).search).moment
        .place.lat,
    ).toBe(m.place.lat);
  });
  it.each([
    "lat=100&lon=10&tz=UTC&at=1998-07-15T20:30:00Z",
    "lat=&lon=10&tz=UTC&at=1998-07-15T20:30:00Z",
    "lat=NaN&lon=10&tz=UTC&at=1998-07-15T20:30:00Z",
    "lat=40&lon=-181&tz=UTC&at=1998-07-15T20:30:00Z",
    "lat=40&lon=10&tz=Broken&at=1998-07-15T20:30:00Z",
    "lat=40&lon=10&tz=UTC&at=1998-07-15T20:30:00",
    "lat=40&lon=10&tz=UTC&at=1998-02-30T20:30:00Z",
    "lat=40&lon=10&tz=UTC&at=2101-07-15T20:30:00Z",
    "lat=40",
  ])("rejects corrupt state: %s", (search) => {
    const r = readMoment(search);
    expect(r.warning).toBeTruthy();
    expect(r.moment.ms).toBe(Date.now());
    expect(r.moment.place.label).toBe("Istanbul");
    expect(r.moment.place.zone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });
});

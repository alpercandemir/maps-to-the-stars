import { afterEach, describe, expect, it, vi } from "vitest";
import { parsePlaces, searchPlaces } from "./geocoding";

const tokyo = {
  formatted: "Shinjuku, Tokyo, Japan",
  country: "Japan",
  lat: 35.69,
  lon: 139.7,
  timezone: { name: "Asia/Tokyo" },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("place results", () => {
  it("preserves an IANA zone for historical clock rules rather than a current offset", () => {
    expect(parsePlaces({ results: [tokyo] })).toEqual([
      {
        label: tokyo.formatted,
        country: "Japan",
        lat: 35.69,
        lon: 139.7,
        zone: "Asia/Tokyo",
      },
    ]);
  });
  it("rejects broken coordinates and leaves missing/invalid time zones for manual entry", () => {
    const results = parsePlaces({
      results: [
        null,
        { ...tokyo, lat: 91 },
        { ...tokyo, lon: NaN },
        { ...tokyo, timezone: null },
        { ...tokyo, timezone: { name: "+03:00" } },
      ],
    });
    expect(results).toHaveLength(2);
    expect(results.every((p) => p.zone === undefined)).toBe(true);
    expect(() => parsePlaces({ error: "invalid" })).toThrow(
      "unexpected response",
    );
  });
  it("skips short queries and caches repeated searches", async () => {
    vi.stubEnv("VITE_GEOAPIFY_API_KEY", "test-browser-key");
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ results: [tokyo] })));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    expect(await searchPlaces("ab", signal)).toEqual([]);
    await searchPlaces("Shinjuku Tokyo", signal);
    await searchPlaces(" shinjuku tokyo ", signal);
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.searchParams.get("text")).toBe("Shinjuku Tokyo");
    expect(url.searchParams.get("limit")).toBe("6");
  });
  it("handles quota failures without caching the failure", async () => {
    vi.stubEnv("VITE_GEOAPIFY_API_KEY", "test-browser-key");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [tokyo] })),
      );
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await expect(searchPlaces("quota test", signal)).rejects.toThrow("busy");
    expect(await searchPlaces("quota test", signal)).toHaveLength(1);
  });
});

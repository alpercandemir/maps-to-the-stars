import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseIPPlace,
  parsePlaces,
  placeFromIP,
  searchPlaces,
} from "./geocoding";

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

describe("approximate city detection", () => {
  const result = {
    city: { name: "Tokyo" },
    country: { name: "Japan" },
    location: { latitude: 35.69, longitude: 139.7 },
  };
  it("reads city coordinates without using the IP address or inferred time zone", () => {
    expect(parseIPPlace(result)).toEqual({
      label: "Tokyo",
      country: "Japan",
      lat: 35.69,
      lon: 139.7,
    });
  });
  it.each([
    null,
    {},
    { ...result, city: null },
    { ...result, city: { name: " " } },
    { ...result, location: { latitude: 91, longitude: 0 } },
    { ...result, location: { latitude: 0, longitude: -181 } },
    { ...result, location: { latitude: NaN, longitude: 0 } },
    { ...result, location: { latitude: 0, longitude: Infinity } },
    { ...result, location: { latitude: "35.69", longitude: 139.7 } },
  ])("ignores incomplete or invalid city results: %j", (value) => {
    expect(parseIPPlace(value)).toBeUndefined();
  });
  it("makes no request without a configured key", async () => {
    vi.stubEnv("VITE_GEOAPIFY_API_KEY", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await placeFromIP(new AbortController().signal)).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the visitor's request IP and forwards cancellation", async () => {
    vi.stubEnv("VITE_GEOAPIFY_API_KEY", "test-browser-key");
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(result)));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    expect(await placeFromIP(controller.signal)).toMatchObject({
      label: "Tokyo",
    });
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.pathname).toBe("/v1/ipinfo");
    expect(url.searchParams.has("ip")).toBe(false);
    expect(fetch.mock.calls[0][1]).toEqual({
      signal: controller.signal,
      credentials: "omit",
    });
  });
  it("rejects failed lookups so the app can retain Istanbul", async () => {
    vi.stubEnv("VITE_GEOAPIFY_API_KEY", "test-browser-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 429 })),
    );
    await expect(placeFromIP(new AbortController().signal)).rejects.toThrow(
      "unavailable",
    );
  });
});

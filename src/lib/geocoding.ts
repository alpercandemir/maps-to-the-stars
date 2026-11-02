import type { Place } from "./catalog";
import { validZone } from "./time";

export const geocodingEnabled = Boolean(
  import.meta.env.VITE_GEOAPIFY_API_KEY?.trim(),
);
export type FoundPlace = Omit<Place, "zone"> & { zone?: string };
const cache = new Map<string, { at: number; places: FoundPlace[] }>();

export function parsePlaces(data: unknown): FoundPlace[] {
  const results = (data as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results))
    throw new Error("Place search returned an unexpected response. Try again.");
  return results.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const p = value as Record<string, unknown>;
    if (
      typeof p.lat !== "number" ||
      typeof p.lon !== "number" ||
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lon) ||
      Math.abs(p.lat) > 90 ||
      Math.abs(p.lon) > 180 ||
      typeof p.formatted !== "string"
    )
      return [];
    const zone = (p.timezone as { name?: unknown } | undefined)?.name;
    return [
      {
        label: p.formatted.slice(0, 100),
        country: typeof p.country === "string" ? p.country : "Selected place",
        lat: p.lat,
        lon: p.lon,
        zone: typeof zone === "string" && validZone(zone) ? zone : undefined,
      },
    ];
  });
}

async function request(
  path: string,
  params: Record<string, string>,
  signal: AbortSignal,
) {
  const key = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim();
  if (!key)
    throw new Error(
      "Worldwide search is unavailable. Choose a saved city or enter coordinates.",
    );
  const url = new URL(`https://api.geoapify.com/v1/geocode/${path}`);
  url.search = new URLSearchParams({
    ...params,
    format: "json",
    apiKey: key,
  }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Place search is busy. Try again later, choose a saved city or enter coordinates."
        : "Place search is unavailable. Choose a saved city or enter coordinates.",
    );
  return parsePlaces(await response.json());
}

export async function searchPlaces(query: string, signal: AbortSignal) {
  const text = query.trim();
  if (text.length < 3) return [];
  const id = text.toLocaleLowerCase();
  const saved = cache.get(id);
  if (saved && Date.now() - saved.at < 86_400_000) return saved.places;
  const places = await request("autocomplete", { text, limit: "6" }, signal);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(id, { at: Date.now(), places });
  return places;
}

export async function placeAt(lat: number, lon: number, signal: AbortSignal) {
  return (
    await request("reverse", { lat: String(lat), lon: String(lon) }, signal)
  )[0];
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, LocateFixed, MapPin, Search } from "lucide-react";
import { CITIES, type Place } from "../lib/catalog";
import { validZone } from "../lib/time";
import Dialog from "./Dialog";
import {
  geocodingEnabled,
  searchPlaces,
  placeAt,
  type FoundPlace,
} from "../lib/geocoding";
export default function PlacePicker({
  place,
  onSelect,
  onClose,
}: {
  place: Place;
  onSelect: (p: Place) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(""),
    [manual, setManual] = useState(false);
  const [lat, setLat] = useState(String(place.lat)),
    [lon, setLon] = useState(String(place.lon)),
    [zone, setZone] = useState(place.zone),
    [label, setLabel] = useState("My place");
  const [error, setError] = useState(""),
    [locating, setLocating] = useState(false);
  const [found, setFound] = useState<FoundPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const locationRequest = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      locationRequest.current?.abort();
      locationRequest.current = null;
    },
    [],
  );
  useEffect(() => {
    setFound([]);
    setSearchError("");
    setSearching(false);
    if (manual || !geocodingEnabled || query.trim().length < 3) return;
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const places = await searchPlaces(query, controller.signal);
        if (!controller.signal.aborted) setFound(places);
      } catch {
        if (active)
          setSearchError(
            "Worldwide search is unavailable. Try again, choose a saved city or enter coordinates.",
          );
      } finally {
        clearTimeout(timeout);
        if (active) setSearching(false);
      }
    }, 400);
    let active = true;
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, manual]);
  const filtered = CITIES.filter((p) =>
    `${p.label} ${p.country}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes(
        query
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
      ),
  );
  const results = [
    ...filtered,
    ...found.filter(
      (p) =>
        !filtered.some(
          (city) =>
            Math.abs(city.lat - p.lat) < 0.001 &&
            Math.abs(city.lon - p.lon) < 0.001,
        ),
    ),
  ];
  function choose(p: FoundPlace) {
    if (p.zone) return onSelect({ ...p, zone: p.zone });
    setLat(String(p.lat));
    setLon(String(p.lon));
    setLabel(p.label);
    setZone("");
    setManual(true);
    setError(
      "This place has no time zone. Enter its IANA time zone to continue.",
    );
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      !lat.trim() ||
      !lon.trim() ||
      !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lon)) ||
      Math.abs(Number(lat)) > 90 ||
      Math.abs(Number(lon)) > 180
    )
      return setError(
        "Latitude must be −90 to 90; longitude must be −180 to 180.",
      );
    if (!validZone(zone.trim()))
      return setError("Enter an IANA time zone, for example Europe/Istanbul.");
    onSelect({
      label: label.trim() || "Selected coordinates",
      country: "Custom coordinates",
      lat: Number(lat),
      lon: Number(lon),
      zone: zone.trim(),
    });
  }
  function locate() {
    setError("");
    if (!navigator.geolocation)
      return setError(
        "Your browser does not support location. Enter coordinates instead.",
      );
    setLocating(true);
    const controller = new AbortController();
    locationRequest.current?.abort();
    locationRequest.current = controller;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (controller.signal.aborted) return;
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
        setLabel("My location");
        setZone("");
        setManual(true);
        if (geocodingEnabled) {
          const timeout = setTimeout(() => controller.abort(), 8000);
          try {
            const result = await placeAt(
              pos.coords.latitude,
              pos.coords.longitude,
              controller.signal,
            );
            if (!controller.signal.aborted && result?.zone)
              setZone(result.zone);
          } catch {
            /* Coordinates remain usable when reverse lookup is unavailable. */
          } finally {
            clearTimeout(timeout);
          }
        }
        if (locationRequest.current === controller) setLocating(false);
      },
      () => {
        if (controller.signal.aborted) return;
        setLocating(false);
        setError(
          "Location was unavailable or permission was denied. You can enter coordinates instead.",
        );
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  return (
    <Dialog title="Location" onClose={onClose}>
      <div className="segmented">
        <button
          className={!manual ? "active" : ""}
          onClick={() => setManual(false)}
        >
          Find a place
        </button>
        <button
          className={manual ? "active" : ""}
          onClick={() => setManual(true)}
        >
          Coordinates
        </button>
      </div>
      {!manual ? (
        <>
          <label className="search-field">
            <Search size={17} />
            <input
              autoFocus
              aria-label="Search places"
              placeholder={
                geocodingEnabled
                  ? "Search cities, districts or addresses…"
                  : "Search saved cities…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="city-list">
            {results.map((p, i) => (
              <button key={`${p.label}-${i}`} onClick={() => choose(p)}>
                <MapPin size={17} />
                <span>
                  {p.label}
                  <small>{p.country}</small>
                </span>
                {p.label === place.label ? (
                  <Check size={17} />
                ) : (
                  <ArrowUpRight size={16} />
                )}
              </button>
            ))}
            {results.length === 0 && !searching && !searchError && (
              <p className="empty">
                No place found. Try a different name or enter coordinates.
              </p>
            )}
          </div>
          <p className="field-note" role="status">
            {searching
              ? "Searching worldwide…"
              : searchError ||
                (!geocodingEnabled
                  ? "Worldwide search is unavailable. Saved cities and coordinates still work."
                  : query.trim().length < 3
                    ? "Type at least 3 characters to search worldwide."
                    : "")}
          </p>
          {geocodingEnabled && (
            <p className="field-note geocoding-credit">
              Search text is sent to{" "}
              <a
                href="https://www.geoapify.com/"
                target="_blank"
                rel="noreferrer"
              >
                Geoapify
              </a>
              . Powered by <a href="https://www.geoapify.com/">Geoapify</a> ·{" "}
              <a href="https://www.openstreetmap.org/copyright">
                © OpenStreetMap contributors
              </a>
            </p>
          )}
        </>
      ) : (
        <form onSubmit={submit} className="coordinate-form">
          <label>
            Place name
            <input
              maxLength={100}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <div className="input-pair">
            <label>
              Latitude
              <input
                type="number"
                min="-90"
                max="90"
                step="any"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                min="-180"
                max="180"
                step="any"
                required
                value={lon}
                onChange={(e) => setLon(e.target.value)}
              />
            </label>
          </div>
          <label>
            IANA time zone
            <input
              required
              value={zone}
              disabled={locating}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Europe/Istanbul"
              list="zones"
            />
            <datalist id="zones">
              {[...new Set(CITIES.map((p) => p.zone))].map((z) => (
                <option key={z} value={z} />
              ))}
              <option value="UTC" />
            </datalist>
          </label>
          <p className="field-note">
            Choose the time zone for these coordinates. Coordinates alone do not
            determine historical clock rules.
          </p>
          <button className="primary-button" type="submit" disabled={locating}>
            Set location <ArrowUpRight size={16} />
          </button>
        </form>
      )}
      <button className="location-button" onClick={locate} disabled={locating}>
        <LocateFixed size={16} />
        {locating ? "Finding your coordinates…" : "Use my location"}
        <span>asks permission</span>
      </button>
      {manual && label === "My location" && (
        <p className="field-note">
          Coordinates found. Check the time zone above before choosing this
          place.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </Dialog>
  );
}

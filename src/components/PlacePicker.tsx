import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, LocateFixed, MapPin, Search } from "lucide-react";
import { CITIES, type Place } from "../lib/catalog";
import { validZone } from "../lib/time";
import Dialog from "./Dialog";
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
        setLabel("My location");
        setManual(true);
        setLocating(false);
      },
      () => {
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
          Find a city
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
              aria-label="Search cities"
              placeholder="Search cities…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="city-list">
            {filtered.map((p) => (
              <button key={p.label} onClick={() => onSelect(p)}>
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
            {filtered.length === 0 && (
              <p className="empty">
                No city found. Use exact coordinates for any other place.
              </p>
            )}
          </div>
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
          <button className="primary-button" type="submit">
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

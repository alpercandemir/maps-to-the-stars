import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  EyeOff,
  Info,
  MapPin,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Share2,
  X,
} from "lucide-react";
import { type Place } from "./lib/catalog";
import {
  calculateSky,
  compass,
  events,
  phaseName,
  type SkyObject,
} from "./lib/sky";
import {
  clock,
  inRange,
  inputs,
  parseLocal,
  prettyDate,
  shiftCalendar,
  zoned,
  type LocalResult,
} from "./lib/time";
import { DEFAULT, readMoment, shareURL } from "./lib/state";
import { createStarTrailSampler } from "./lib/trails";
import { solarContext } from "./lib/daylight";
import {
  readSavedMoments,
  writeSavedMoments,
  type SavedMoment,
  type StarterSky,
} from "./lib/moments";
import MomentsShelf, { SkyStamp } from "./components/MomentsShelf";
import SkyMap from "./components/SkyMap";
import Dialog from "./components/Dialog";
import PlacePicker from "./components/PlacePicker";

const initial = readMoment(window.location.search);
const initialShelf = readSavedMoments();
const HOUR = 3600_000;
export default function App() {
  const [place, setPlace] = useState(initial.moment.place),
    [ms, setMs] = useState(initial.moment.ms);
  const [anchor, setAnchor] = useState(ms),
    [center, setCenter] = useState(ms);
  const [draft, setDraft] = useState(inputs(ms, place.zone));
  const [playing, setPlaying] = useState(false),
    [direction, setDirection] = useState(1),
    [speed, setSpeed] = useState(30);
  const [selected, setSelected] = useState<string | null>(null),
    [labels, setLabels] = useState(true);
  const [trailsEnabled, setTrailsEnabled] = useState(false);
  const [modal, setModal] = useState<
    "place" | "about" | "share" | "objects" | "save" | null
  >(null);
  const [notice, setNotice] = useState(
      initial.warning || initialShelf.warning || "",
    ),
    [copied, setCopied] = useState(false);
  const [moments, setMoments] = useState(initialShelf.moments);
  const [removed, setRemoved] = useState<{
    moment: SavedMoment;
    index: number;
  } | null>(null);
  const [cardTitle, setCardTitle] = useState("A sky to remember");
  const [saveTitle, setSaveTitle] = useState("");
  const [saveError, setSaveError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [pending, setPending] = useState<{
    result: Extract<LocalResult, { kind: "ambiguous" }>;
    commit: (ms: number) => void;
  } | null>(null);
  const shareRef = useRef<HTMLInputElement>(null);
  const dateEdit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skyRef = useRef<HTMLElement>(null);
  const objects = useMemo(() => calculateSky(ms, place), [ms, place]);
  const solar = useMemo(() => solarContext(ms, place), [ms, place]);
  const sampleTrails = useMemo(
    () => (trailsEnabled ? createStarTrailSampler(place) : null),
    [place, trailsEnabled],
  );
  const trails = useMemo(
    () => sampleTrails?.(ms, objects) ?? [],
    [sampleTrails, ms, objects],
  );
  const object = objects.find((o) => o.id === selected);
  const visible = objects.filter((o) => o.altitude >= 0);
  const visibleCount = visible.length;
  const local = zoned(ms, place.zone);
  const isDefaultPlace =
    place.lat === DEFAULT.place.lat && place.lon === DEFAULT.place.lon;
  const url = shareURL({ place, ms }, window.location.href);
  const detailEvents = useMemo(
    () => (playing || !object ? undefined : events(object.body, ms, place)),
    [object?.body, ms, place, playing],
  );

  useEffect(() => {
    setDraft(inputs(ms, place.zone));
    return () => clearTimeout(dateEdit.current);
  }, [ms, place.zone]);
  useEffect(() => {
    if (!playing) return;
    let frame: number, previous: number | undefined;
    const tick = (now: number) => {
      const elapsed =
        previous === undefined ? 0 : Math.min(now - previous, 250);
      previous = now;
      setMs((current) => {
        const next = Math.round(current + elapsed * speed * 60 * direction);
        if (!inRange(next, place.zone)) {
          setPlaying(false);
          return current;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, direction, place.zone]);
  useEffect(() => {
    if (Math.abs(ms - center) > 12 * HOUR) setCenter(ms);
  }, [ms, center]);
  // Keep the address reproducible without a history entry for every playback frame.
  useEffect(() => {
    if (playing) return;
    const timeout = setTimeout(
      () =>
        window.history.replaceState(
          null,
          "",
          shareURL({ place, ms }, window.location.href),
        ),
      200,
    );
    return () => clearTimeout(timeout);
  }, [ms, place, playing]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (
        modal ||
        pending ||
        (e.target instanceof HTMLElement &&
          e.target.closest('input,select,textarea,button,[role="button"]'))
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [modal, pending]);

  function move(next: number, remember = false) {
    clearTimeout(dateEdit.current);
    if (!inRange(next, place.zone)) {
      setPlaying(false);
      setNotice("Choose a moment between 1900 and 2100.");
      return;
    }
    setPlaying(false);
    setNotice("");
    setMs(next);
    setCenter(next);
    if (remember) setAnchor(next);
  }
  function handleLocal(result: LocalResult, remember = false) {
    if (result.kind === "error") {
      setNotice(result.message);
      return;
    }
    if (result.kind === "ambiguous") {
      setPlaying(false);
      setPending({ result, commit: (value) => move(value, remember) });
      return;
    }
    move(result.ms, remember);
  }
  function editLocal(next: typeof draft) {
    clearTimeout(dateEdit.current);
    setPlaying(false);
    setDraft(next);
    setNotice("");
    if (!next.date || !next.time) return;
    dateEdit.current = setTimeout(() => {
      handleLocal(parseLocal(next.date, next.time, place.zone), true);
    }, 400);
  }
  function changePlace(p: Place) {
    clearTimeout(dateEdit.current);
    if (!inRange(ms, p.zone)) {
      setNotice(
        "This moment is outside 1900–2100 in that time zone. Choose another moment first.",
      );
      return;
    }
    setPlaying(false);
    setPlace(p);
    setModal(null);
    setNotice("");
  }
  function tonight() {
    const d = inputs(Date.now(), place.zone).date;
    handleLocal(parseLocal(d, "22:00", place.zone), true);
  }
  function showMoments() {
    setPlaying(false);
    const heading = document.getElementById("moments-heading");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      shareRef.current?.select();
      setNotice("Copy the selected link from the sharing panel.");
    }
  }
  function persistShelf(next: SavedMoment[]) {
    try {
      writeSavedMoments(next);
      setMoments(next);
      setSaveError("");
      return true;
    } catch {
      const message =
        "Could not save Moments on this device. Browser storage may be full or unavailable. You can download a sky card instead.";
      setSaveError(message);
      setNotice(message);
      return false;
    }
  }
  function saveMoment(e: FormEvent) {
    e.preventDefault();
    if (!saveTitle.trim()) return;
    const moment: SavedMoment = {
      id: crypto.randomUUID(),
      title: saveTitle.trim(),
      place: { ...place },
      ms,
      trails: trailsEnabled,
      labels,
    };
    if (persistShelf([...moments, moment])) {
      setCardTitle(moment.title);
      setRemoved(null);
      setModal(null);
    }
  }
  function restoreMoment(moment: SavedMoment | StarterSky) {
    clearTimeout(dateEdit.current);
    setPlaying(false);
    setPlace({ ...moment.place });
    setMs(moment.ms);
    setAnchor(moment.ms);
    setCenter(moment.ms);
    setTrailsEnabled(moment.trails);
    setLabels("labels" in moment ? moment.labels : true);
    setSelected(null);
    setCardTitle(moment.title);
    setNotice("");
    requestAnimationFrame(() => {
      skyRef.current?.focus({ preventScroll: true });
      skyRef.current?.scrollIntoView({ block: "start" });
    });
  }
  function removeMoment(moment: SavedMoment) {
    const index = moments.findIndex((item) => item.id === moment.id);
    if (persistShelf(moments.filter((item) => item.id !== moment.id)))
      setRemoved({ moment, index });
  }
  function undoRemove() {
    if (!removed) return;
    const next = [...moments];
    next.splice(removed.index, 0, removed.moment);
    if (persistShelf(next)) setRemoved(null);
  }
  async function exportCard(format: "svg" | "png") {
    setExporting(true);
    setExportMessage("");
    try {
      const { downloadSkyCard } = await import("./lib/postcard");
      await downloadSkyCard(
        { place, ms },
        cardTitle,
        { trails: trailsEnabled, labels },
        format,
      );
      setExportMessage(`${format.toUpperCase()} sky card downloaded.`);
    } catch {
      setExportMessage(
        "The sky card could not be downloaded. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }
  const openModal = (value: typeof modal) => {
    setPlaying(false);
    setModal(value);
    setCopied(false);
    setExportMessage("");
    if (value === "save") {
      setSaveTitle(cardTitle);
      setSaveError("");
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <a
            className="wordmark"
            href={window.location.pathname}
            aria-label="maps to the stars home"
          >
            maps to the stars
          </a>
          <p className="brand-tagline">The sky, through time.</p>
        </div>
        <div className="header-actions">
          <button
            className="moments-nav"
            aria-label="Explore Moments and starter skies"
            onClick={showMoments}
          >
            <Bookmark size={15} />
            <span>Moments</span>
          </button>
          <button
            className="icon-button"
            aria-label="Map information"
            title="Map information"
            onClick={() => openModal("about")}
          >
            <Info size={17} />
          </button>
          <button className="share-button" onClick={() => openModal("share")}>
            <Share2 size={15} />
            Share
          </button>
        </div>
      </header>
      <main>
        <h1 className="sr-only">Sky map</h1>
        <div className="experience-grid">
          <section className="journey-panel" aria-label="Location and time">
            <div className="journey-controls">
              <h2 className="control-heading">Location</h2>
              <button
                className="place-control"
                onClick={() => openModal("place")}
              >
                <MapPin size={16} />
                <span>
                  <strong>{place.label}</strong>
                  <small
                    className={isDefaultPlace ? "default-place" : undefined}
                  >
                    {place.country}
                    {isDefaultPlace ? " · default" : ""}
                  </small>
                </span>
                <ChevronDown size={14} />
              </button>
              <div className="coordinates">
                {Math.abs(place.lat).toFixed(4)}° {place.lat >= 0 ? "N" : "S"}
                <span> / </span>
                {Math.abs(place.lon).toFixed(4)}° {place.lon >= 0 ? "E" : "W"}
              </div>
              <div className="control-heading moment-heading">
                <h2>Date & time</h2>
                <div className="now-actions">
                  <button onClick={() => move(Date.now(), true)}>Now</button>
                  <button
                    onClick={tonight}
                    title="Today at 22:00 in the selected time zone"
                  >
                    Tonight
                  </button>
                </div>
              </div>
              <div className="date-time-controls">
                <div className="date-time-fields">
                  <label>
                    <span>Date</span>
                    <input
                      name="date"
                      aria-label="Local date"
                      required
                      type="date"
                      onFocus={() => setPlaying(false)}
                      min="1900-01-01"
                      max="2100-12-31"
                      value={draft.date}
                      onChange={(e) =>
                        editLocal({ ...draft, date: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Local time</span>
                    <input
                      name="time"
                      aria-label="Local time"
                      required
                      type="time"
                      onFocus={() => setPlaying(false)}
                      value={draft.time}
                      onChange={(e) =>
                        editLocal({ ...draft, time: e.target.value })
                      }
                    />
                  </label>
                </div>
                <div className="zone-note">
                  <span>{place.zone}</span>
                  <span>UTC{local.offset}</span>
                </div>
              </div>
              <div className="jump-controls" aria-label="Calendar jumps">
                <div>
                  <span>Day</span>
                  <button
                    aria-label="Previous day"
                    onClick={() =>
                      handleLocal(shiftCalendar(ms, place.zone, 0, -1))
                    }
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    aria-label="Next day"
                    onClick={() =>
                      handleLocal(shiftCalendar(ms, place.zone, 0, 1))
                    }
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div>
                  <span>Month</span>
                  <button
                    aria-label="Previous month"
                    onClick={() =>
                      handleLocal(shiftCalendar(ms, place.zone, -1))
                    }
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    aria-label="Next month"
                    onClick={() =>
                      handleLocal(shiftCalendar(ms, place.zone, 1))
                    }
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div>
                  <span>6 mo</span>
                  <button
                    aria-label="Previous six months"
                    onClick={() =>
                      handleLocal(shiftCalendar(ms, place.zone, -6))
                    }
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    aria-label="Next six months"
                    onClick={() =>
                      handleLocal(shiftCalendar(ms, place.zone, 6))
                    }
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
            {object && (
              <ObjectCard
                object={object}
                detailEvents={detailEvents}
                ms={ms}
                place={place}
                playing={playing}
                onJump={move}
                onClose={() => setSelected(null)}
              />
            )}
          </section>
          <section
            ref={skyRef}
            tabIndex={-1}
            className="sky-section"
            aria-label="Sky map"
          >
            <div className="sky-toolbar">
              <div className="sky-context">
                <span className="view-status">
                  {visibleCount} of 9 above horizon
                </span>
                <span
                  className={`solar-status solar-${solar.band}`}
                  title={`Sun altitude ${solar.altitude.toFixed(1)}°. ${solar.description}`}
                >
                  <span aria-hidden="true" />
                  {solar.label}
                </span>
              </div>
              <div className="view-actions">
                <button
                  className="trails-button"
                  aria-pressed={trailsEnabled}
                  aria-label="Show star trails for the previous two hours"
                  title="Star trails · previous 2 hours"
                  onClick={() => setTrailsEnabled((value) => !value)}
                >
                  <span className="trail-swatch" aria-hidden="true" />
                  Trails
                  <span className="trail-duration">2h</span>
                </button>
                <button
                  className="icon-button"
                  aria-label={labels ? "Hide star labels" : "Show star labels"}
                  aria-pressed={labels}
                  title="Star labels"
                  onClick={() => setLabels((v) => !v)}
                >
                  {labels ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  onClick={() => openModal("objects")}
                  className="objects-button"
                >
                  Objects
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>
            <div className="sky-canvas">
              <SkyMap
                objects={objects}
                selected={selected}
                onSelect={setSelected}
                labels={labels}
                trails={trails}
                solar={solar}
              />
            </div>
            <p className="visibility-note">
              {solar.band === "day"
                ? "Daylight can hide these stars. The map shows their calculated positions."
                : solar.band !== "night"
                  ? "Twilight brightens the sky. Stars remain at their calculated positions."
                  : "A calculated sky. Visibility depends on clouds, terrain and light pollution."}
            </p>
          </section>
        </div>
        {notice && (
          <div className="notice" role="alert">
            <Info size={16} />
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <section className="time-machine" aria-label="Time travel playback">
          <div className="timeline-top">
            <div className="timeline-title">
              <Clock3 size={14} />
              <span>Time</span>
            </div>
            <button
              className="return-button"
              aria-label="Reset to selected moment"
              onClick={() => move(anchor)}
              disabled={ms === anchor}
            >
              <RotateCcw size={13} />
              Reset
            </button>
            <span className="timeline-date">
              {prettyDate(ms, place.zone)}
              <span>{clock(ms, place.zone)}</span>
            </span>
          </div>
          <div className="playback-row">
            <div className="playback-buttons">
              <button
                className="icon-button"
                aria-label="Go back 24 hours"
                title="Go back 24 elapsed hours"
                onClick={() => move(ms - 24 * HOUR)}
              >
                <ArrowLeft size={17} />
              </button>
              <button
                className="play-button"
                aria-label={playing ? "Pause time" : "Play time"}
                onClick={() => setPlaying((v) => !v)}
              >
                {playing ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
              </button>
              <button
                className="icon-button"
                aria-label="Go forward 24 hours"
                title="Go forward 24 elapsed hours"
                onClick={() => move(ms + 24 * HOUR)}
              >
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="slider-wrap">
              <div className="timeline-ticks" aria-hidden="true">
                {Array.from({ length: 49 }, (_, i) => (
                  <i key={i} className={i % 4 === 0 ? "long" : ""} />
                ))}
              </div>
              <input
                className="time-slider"
                type="range"
                min={-43200}
                max={43200}
                step="1"
                value={(ms - center) / 1000}
                aria-label="Scrub through 24 hours"
                aria-valuetext={`${prettyDate(ms, place.zone)}, ${clock(ms, place.zone)}, UTC${local.offset}`}
                onChange={(e) => {
                  setPlaying(false);
                  const n = center + Number(e.target.value) * 1000;
                  if (inRange(n, place.zone)) setMs(n);
                }}
              />
              <div className="timeline-labels">
                {[-12, -6, 0, 6, 12].map((h) => (
                  <span key={h}>{clock(center + h * HOUR, place.zone)}</span>
                ))}
              </div>
            </div>
            <div className="speed-controls">
              <button
                className="direction-button"
                aria-label={
                  direction === 1
                    ? "Switch to backward playback"
                    : "Switch to forward playback"
                }
                title="Playback direction"
                onClick={() => setDirection((d) => -d)}
              >
                {direction === 1 ? (
                  <ArrowRight size={14} />
                ) : (
                  <ArrowLeft size={14} />
                )}
                <span>{direction === 1 ? "Forward" : "Backward"}</span>
              </button>
              <label className="speed-select">
                <span className="sr-only">Playback speed</span>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  <option value="5">5 min / sec</option>
                  <option value="30">30 min / sec</option>
                  <option value="120">2 hr / sec</option>
                </select>
              </label>
            </div>
          </div>
        </section>
        <MomentsShelf
          moments={moments}
          onSave={() => openModal("save")}
          onRestore={restoreMoment}
          onRemove={removeMoment}
          onStarter={restoreMoment}
          undo={removed?.moment.title ?? null}
          onUndo={undoRemove}
        />
      </main>
      {modal === "place" && (
        <PlacePicker
          place={place}
          onSelect={changePlace}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "about" && (
        <Dialog title="Map information" onClose={() => setModal(null)}>
          <div className="about-content">
            <p>
              This is an astronomical reconstruction, not a photograph or a
              record of what someone could actually see. Clouds, daylight,
              terrain and light pollution can hide these objects. We show their
              geometric positions.
            </p>
            <h3>Projection</h3>
            <p>
              The centre is overhead; the outer circle is the horizon. North is
              up, east is right. Rings mark 30° and 60° altitude.
            </p>
            <h3>Calculations</h3>
            <p>
              The sky tint illustrates the Sun’s geometric altitude, not
              observed brightness. Daylight begins at 0° centre altitude in this
              model; civil, nautical and astronomical twilight extend to −6°,
              −12° and −18°. Refraction, the Sun’s apparent radius, weather and
              terrain are not modelled.{" "}
              <a
                href="https://aa.usno.navy.mil/faq/RST_defs"
                target="_blank"
                rel="noreferrer"
              >
                About twilight definitions
              </a>
              .
            </p>
            <p>
              Optional star trails trace the previous two hours of simulated
              time, fading toward the past. They follow the selected moment,
              including during backward playback, and stop at the horizon.
              Trails show the eight stars; the Moon remains a single disc.
            </p>
            <p>
              Positions use{" "}
              <a
                href="https://github.com/cosinekitty/astronomy"
                target="_blank"
                rel="noreferrer"
              >
                Astronomy Engine
              </a>{" "}
              with precession, nutation and lunar parallax. Star coordinates are
              J2000 values from{" "}
              <a
                href="https://simbad.cds.unistra.fr/simbad/"
                target="_blank"
                rel="noreferrer"
              >
                SIMBAD
              </a>
              ; proper motion is omitted. Rise and set refer to the object’s
              centre crossing a flat, unrefracted horizon. The Moon icon shows
              approximate phase, not its sky orientation.
            </p>
            <p>
              Historical clock changes use your browser’s IANA time-zone data
              through Temporal. Early records can be uncertain; future clock
              rules may change. Playback speed is simulated minutes per real
              second.
            </p>
            <p className="field-note">
              Keyboard: Tab to explore, Enter to select. Space plays or pauses
              when controls are not focused. Arrow keys adjust the timeline when
              focused.
            </p>
          </div>
        </Dialog>
      )}
      {modal === "share" && (
        <Dialog title="Share" onClose={() => setModal(null)}>
          <div className="share-summary">
            <Moon size={24} />
            <div>
              <strong>{place.label}</strong>
              <p>
                {prettyDate(ms, place.zone)} · {clock(ms, place.zone)}
              </p>
              <small>
                {place.zone} · UTC{local.offset}
              </small>
            </div>
          </div>
          <label className="share-label">
            Link
            <input
              ref={shareRef}
              value={url}
              readOnly
              onFocus={(e) => e.target.select()}
              aria-label="Shareable moment URL"
            />
          </label>
          <button className="primary-button" onClick={copy}>
            {copied ? "Link copied" : "Copy link"}
            {copied ? <Check size={17} /> : <Copy size={17} />}
          </button>
          <p className="field-note">
            Includes the selected coordinates and time.
          </p>
          <div className="card-export">
            <h3>A sky to keep</h3>
            <label className="share-label">
              Card title
              <input
                maxLength={60}
                value={cardTitle}
                onChange={(e) => setCardTitle(e.target.value)}
              />
            </label>
            <div className="export-buttons">
              <button onClick={() => exportCard("svg")} disabled={exporting}>
                <Download size={14} />
                Download SVG
              </button>
              <button onClick={() => exportCard("png")} disabled={exporting}>
                <Download size={14} />
                Download PNG
              </button>
            </div>
            <p className="field-note">
              Includes the current labels and trails. SVG keeps its detail at
              any size; PNG is ready to share.
            </p>
            <p className="export-status" role="status">
              {exporting ? "Preparing your sky card…" : exportMessage}
            </p>
          </div>
        </Dialog>
      )}
      {modal === "save" && (
        <Dialog title="Save this sky" onClose={() => setModal(null)}>
          <div className="save-preview">
            <SkyStamp moment={{ place, ms }} />
            <div>
              <strong>{place.label}</strong>
              <p>
                {prettyDate(ms, place.zone)} · {clock(ms, place.zone)}
              </p>
              <small>
                {place.zone} · UTC{local.offset}
              </small>
            </div>
          </div>
          <form onSubmit={saveMoment}>
            <label className="share-label">
              Moment title
              <input
                autoFocus
                data-autofocus
                required
                maxLength={60}
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
              />
            </label>
            <button type="submit" className="primary-button">
              Save moment
              <Check size={15} />
            </button>
          </form>
          <p className="field-note">
            Saved in this browser on this device, with your labels and trails
            settings. Clearing browser data removes your collection.
          </p>
          {saveError && (
            <p className="error" role="alert">
              {saveError}
            </p>
          )}
        </Dialog>
      )}
      {modal === "objects" && (
        <Dialog title="Objects" onClose={() => setModal(null)}>
          <p className="dialog-intro">
            Objects below the horizon are not shown on the map.
          </p>
          <div className="object-list">
            {objects.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setSelected(o.id);
                  setModal(null);
                }}
              >
                <span className="object-dot" style={{ background: o.color }} />
                <span>
                  {o.name}
                  <small>
                    {o.id === "moon" ? phaseName(o.phase!) : o.constellation}
                  </small>
                </span>
                <span className={o.altitude >= 0 ? "object-up" : "object-down"}>
                  {o.altitude >= 0 ? "Above horizon" : "Below horizon"}
                  <small>{o.altitude.toFixed(1)}°</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {pending && (
        <Dialog
          title="This hour happened twice"
          onClose={() => setPending(null)}
        >
          <p className="dialog-intro">
            The clocks moved backward on this date. Choose which occurrence of
            this local time you mean.
          </p>
          <div className="dst-options">
            {[pending.result.earlier, pending.result.later].map((n, i) => (
              <button
                key={n}
                onClick={() => {
                  pending.commit(n);
                  setPending(null);
                }}
              >
                <span>
                  {i === 0 ? "First occurrence" : "Second occurrence"}
                </span>
                <strong>
                  {clock(n, place.zone)} · UTC{zoned(n, place.zone).offset}
                </strong>
                <small>{new Date(n).toISOString()}</small>
              </button>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  );
}

function ObjectCard({
  object: o,
  detailEvents: ev,
  ms,
  place,
  playing,
  onClose,
  onJump,
}: {
  object: SkyObject;
  detailEvents: ReturnType<typeof events> | undefined;
  ms: number;
  place: Place;
  playing: boolean;
  onClose: () => void;
  onJump: (ms: number) => void;
}) {
  // Rounded catalogue distances support an approximate year, not an exact date.
  const lightYear =
    o.distance && o.distance <= 100
      ? zoned(ms - o.distance * 365.25 * 24 * HOUR, place.zone).year
      : undefined;
  const lightJump =
    lightYear !== undefined && lightYear >= 1900
      ? shiftCalendar(
          ms,
          place.zone,
          (lightYear - zoned(ms, place.zone).year) * 12,
        )
      : undefined;
  function eventTime(value: number | undefined) {
    if (value === undefined) return "Not in next 48h";
    const day =
      inputs(value, place.zone).date === inputs(ms, place.zone).date
        ? ""
        : ` · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: place.zone }).format(value)}`;
    return `${clock(value, place.zone)}${day}`;
  }
  function eventLink(label: string, value: number | undefined) {
    return (
      <span>
        {label}{" "}
        {value === undefined ? (
          <b>{eventTime(value)}</b>
        ) : (
          <button
            className="event-jump"
            disabled={!inRange(value, place.zone)}
            onClick={() => onJump(value)}
            aria-label={`Jump to ${o.name} ${label.toLowerCase()} at ${eventTime(value)}`}
            title={`${prettyDate(value, place.zone)} · UTC${zoned(value, place.zone).offset} · ${new Date(value).toISOString()}${!inRange(value, place.zone) ? " · Outside 1900–2100" : ""}`}
          >
            {eventTime(value)}
          </button>
        )}
      </span>
    );
  }
  return (
    <aside className="object-card" aria-label={`${o.name} details`}>
      <div className="object-card-header">
        <div>
          <h2>{o.name}</h2>
          <span>{o.id === "moon" ? phaseName(o.phase!) : o.constellation}</span>
        </div>
        <button
          className="icon-button close-object"
          aria-label="Close object details"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>
      {o.altitude < 0 && <p className="below-horizon">Below horizon</p>}
      <div className="object-metrics">
        <div>
          <span>Altitude</span>
          <strong>{o.altitude.toFixed(1)}°</strong>
        </div>
        <div>
          <span>Azimuth</span>
          <strong>
            {o.azimuth.toFixed(1)}° <small>{compass(o.azimuth)}</small>
          </strong>
        </div>
        <div>
          <span>{o.id === "moon" ? "Illuminated" : "Magnitude"}</span>
          <strong>
            {o.id === "moon"
              ? `${Math.round(o.fraction! * 100)}%`
              : o.magnitude.toFixed(2)}
          </strong>
        </div>
      </div>
      <div className="object-events">
        {playing ? (
          <span>Pause to see next rise, set and transit.</span>
        ) : (
          <>
            <span className="circumpolar">
              {ev?.status === "always-up" ? (
                <>
                  <RotateCcw size={12} /> Always above the horizon here
                </>
              ) : ev?.status === "always-down" ? (
                <>
                  <ArrowDown size={12} /> Never above the horizon here
                </>
              ) : (
                <>
                  {eventLink("Rise", ev?.rise)}
                  {eventLink("Set", ev?.set)}
                </>
              )}
            </span>
            {eventLink("Highest", ev?.transit)}
          </>
        )}
      </div>
      {lightYear !== undefined && (
        <p className="light-travel">
          Light reaching this sky left {o.name} around{" "}
          <strong>{lightYear}</strong>.
          {lightJump?.kind === "ok" && inRange(lightJump.ms, place.zone) && (
            <button
              className="event-jump"
              onClick={() => onJump(lightJump.ms)}
              title={`Explore the sky in ${lightYear}; this changes the viewing date.`}
            >
              Explore {lightYear}
            </button>
          )}
        </p>
      )}
      <details className="object-notes">
        <summary>About {o.name}</summary>
        <p>{o.description}</p>
      </details>
    </aside>
  );
}

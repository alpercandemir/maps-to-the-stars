import { useMemo } from "react";
import { BookmarkPlus, X } from "lucide-react";
import { calculateSky, project, starRadius } from "../lib/sky";
import { solarContext } from "../lib/daylight";
import { clock, prettyDate } from "../lib/time";
import type { Moment } from "../lib/state";
import {
  STARTER_SKIES,
  MOMENT_LIMIT,
  type SavedMoment,
  type StarterSky,
} from "../lib/moments";
import { MoonDisc } from "./SkyMap";

export function SkyStamp({ moment }: { moment: Moment }) {
  const sky = useMemo(
    () => calculateSky(moment.ms, moment.place),
    [moment.ms, moment.place],
  );
  const light = useMemo(
    () => solarContext(moment.ms, moment.place),
    [moment.ms, moment.place],
  );
  return (
    <svg className="sky-stamp" viewBox="0 0 120 120" aria-hidden="true">
      <circle
        cx="60"
        cy="60"
        r="46"
        fill={light.tint}
        fillOpacity=".3"
        stroke="#90a7bd"
        strokeOpacity=".35"
        strokeWidth=".7"
      />
      <circle
        cx="60"
        cy="60"
        r="23"
        fill="none"
        stroke="#90a7bd"
        strokeOpacity=".2"
        strokeWidth=".5"
        strokeDasharray="1 4"
      />
      <path
        d="M60 9v4 M60 107v4 M9 60h4 M107 60h4"
        stroke="#a9b9ca"
        strokeWidth=".7"
      />
      {sky
        .filter((o) => o.altitude >= 0)
        .map((o) => {
          const p = project(o.azimuth, o.altitude, 46, 60);
          return o.id === "moon" ? (
            <g key={o.id} transform={`translate(${p.x} ${p.y})`}>
              <MoonDisc phase={o.phase!} size={3} />
            </g>
          ) : (
            <circle
              key={o.id}
              cx={p.x}
              cy={p.y}
              r={Math.max(0.8, starRadius(o.magnitude) * 0.45)}
              fill={o.color}
            />
          );
        })}
    </svg>
  );
}

export default function MomentsShelf({
  moments,
  onSave,
  onRestore,
  onRemove,
  onStarter,
  undo,
  onUndo,
}: {
  moments: SavedMoment[];
  onSave: () => void;
  onRestore: (moment: SavedMoment) => void;
  onRemove: (moment: SavedMoment) => void;
  onStarter: (moment: StarterSky) => void;
  undo: string | null;
  onUndo: () => void;
}) {
  return (
    <section className="moments-shelf" aria-labelledby="moments-heading">
      <div className="shelf-heading">
        <div>
          <h2 id="moments-heading" tabIndex={-1}>
            Moments
          </h2>
          <p>A few skies to keep, and a few to begin with.</p>
        </div>
        <button
          className="save-moment-button"
          onClick={onSave}
          disabled={moments.length >= MOMENT_LIMIT}
        >
          <BookmarkPlus size={15} />
          Save this sky
        </button>
      </div>
      <p className="storage-note">
        Saved in this browser on this device.{" "}
        {moments.length >= MOMENT_LIMIT
          ? "Your shelf is full (50 skies). Remove one to save another."
          : ""}
      </p>
      {undo && (
        <p className="shelf-undo" role="status">
          Removed “{undo}”. <button onClick={onUndo}>Undo</button>
        </p>
      )}
      {moments.length > 0 ? (
        <div className="saved-skies" aria-label="Your saved skies">
          {moments.map((moment) => (
            <article className="saved-sky" key={moment.id}>
              <button
                className="restore-sky"
                onClick={() => onRestore(moment)}
                aria-label={`Open ${moment.title}`}
              >
                <SkyStamp moment={moment} />
                <strong>{moment.title}</strong>
                <span>{moment.place.label}</span>
                <small>
                  {prettyDate(moment.ms, moment.place.zone)} ·{" "}
                  {clock(moment.ms, moment.place.zone)}
                </small>
              </button>
              <button
                className="remove-sky icon-button"
                aria-label={`Remove ${moment.title}`}
                onClick={() => onRemove(moment)}
              >
                <X size={13} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="shelf-empty">
          Keep a birthday, a familiar night, or a sky you discovered here.
        </p>
      )}
      <h3 className="starter-heading">Try a sky</h3>
      <div className="starter-skies">
        {STARTER_SKIES.map((moment) => (
          <button
            key={moment.title}
            className="starter-sky"
            onClick={() => onStarter(moment)}
          >
            <SkyStamp moment={moment} />
            <span>
              <strong>{moment.title}</strong>
              <small>{moment.description}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

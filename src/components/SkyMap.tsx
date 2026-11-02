import { useId } from "react";
import { project, starRadius, type SkyObject } from "../lib/sky";
import type { StarTrail } from "../lib/trails";
import type { SolarContext } from "../lib/daylight";
export function MoonDisc({
  phase,
  size = 12,
}: {
  phase: number;
  size?: number;
}) {
  const id = useId().replace(/:/g, "");
  const r = size,
    waxing = phase <= 180;
  const k = Math.cos((phase * Math.PI) / 180);
  // Right/left limb + elliptical terminator. Phase icon is schematic, not limb orientation.
  const path = `M 0 ${-r} A ${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r} A ${Math.max(0.001, Math.abs(k * r))} ${r} 0 0 ${k >= 0 ? (waxing ? 0 : 1) : waxing ? 1 : 0} 0 ${-r}`;
  return (
    <g>
      <defs>
        <radialGradient id={id}>
          <stop stopColor="#fff4d6" />
          <stop offset="1" stopColor="#cebc94" />
        </radialGradient>
      </defs>
      <circle r={r} fill="#282c31" stroke="#b6ab8d" strokeWidth=".5" />
      <path d={path} fill={`url(#${id})`} />
    </g>
  );
}
export default function SkyMap({
  objects,
  selected,
  onSelect,
  labels,
  trails,
  solar,
  interactive = true,
}: {
  objects: SkyObject[];
  selected: string | null;
  onSelect: (id: string) => void;
  labels: boolean;
  trails: StarTrail[];
  solar?: SolarContext;
  interactive?: boolean;
}) {
  const horizonClip = `horizon-${useId().replace(/:/g, "")}`;
  const visible = objects.filter((o) => o.altitude >= 0);
  return (
    <svg
      className="sky-map"
      viewBox="0 0 640 640"
      role="group"
      aria-label={`Calculated sky map. North at top, east at right, zenith at centre. Only objects above the horizon are plotted.${solar ? ` ${solar.label}. ${solar.description}` : ""}${trails.length ? " Star trails show the previous two hours, fading toward the past." : ""}`}
    >
      <defs>
        <clipPath id={horizonClip}>
          <circle cx="320" cy="320" r="250" />
        </clipPath>
        <radialGradient id="sky-glow">
          <stop stopColor={solar?.tint ?? "#192637"} stopOpacity=".55" />
          <stop
            offset=".75"
            stopColor={solar?.tint ?? "#111d2b"}
            stopOpacity=".28"
          />
          <stop offset="1" stopColor="#101923" stopOpacity=".15" />
        </radialGradient>
        <filter id="star-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <circle
        cx="320"
        cy="320"
        r="250"
        fill="url(#sky-glow)"
        className="horizon"
      />
      {[1 / 3, 2 / 3].map((f) => (
        <circle
          key={f}
          cx="320"
          cy="320"
          r={250 * f}
          fill="none"
          className="altitude-ring"
        />
      ))}
      <path d="M 320 70 V 570 M 70 320 H 570" className="axis" />
      {Array.from({ length: 72 }, (_, i) => {
        const a = (i * 5 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={320 + 250 * Math.sin(a)}
            y1={320 - 250 * Math.cos(a)}
            x2={320 + (i % 6 === 0 ? 258 : 254) * Math.sin(a)}
            y2={320 - (i % 6 === 0 ? 258 : 254) * Math.cos(a)}
            className="map-tick"
          />
        );
      })}
      <g className="directions">
        <text x="320" y="41">
          N
        </text>
        <text x="603" y="325">
          E
        </text>
        <text x="320" y="610">
          S
        </text>
        <text x="36" y="325">
          W
        </text>
      </g>
      <g className="map-annotations">
        <text x="328" y="322">
          ZENITH
        </text>
        <text x="328" y="241">
          60°
        </text>
        <text x="328" y="157">
          30°
        </text>
        <text x="328" y="91">
          HORIZON
        </text>
      </g>
      <path
        d="M 316 320 h 8 M 320 316 v 8"
        stroke="#78838f"
        strokeOpacity=".45"
        strokeWidth=".8"
      />
      <g
        className="star-trails"
        clipPath={`url(#${horizonClip})`}
        aria-hidden="true"
      >
        {trails.map((trail) => (
          <g key={trail.id} stroke={trail.color}>
            {trail.segments.map((segment, index) => (
              <path
                key={index}
                d={`M ${segment.from.x} ${segment.from.y} L ${segment.to.x} ${segment.to.y}`}
                opacity={segment.opacity}
              />
            ))}
          </g>
        ))}
      </g>
      {visible.map((o) => {
        const p = project(o.azimuth, o.altitude);
        const active = selected === o.id,
          moon = o.id === "moon",
          radius = moon ? 10 : starRadius(o.magnitude);
        const left = p.x > 515;
        return (
          <g
            key={o.id}
            className={`celestial-object ${active ? "selected" : ""}`}
            transform={`translate(${p.x}, ${p.y})`}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={`${o.name}, altitude ${o.altitude.toFixed(1)} degrees, azimuth ${o.azimuth.toFixed(1)} degrees`}
            aria-pressed={interactive ? active : undefined}
            onClick={interactive ? () => onSelect(o.id) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(o.id);
                    }
                  }
                : undefined
            }
          >
            <title>{`${o.name} · ${o.altitude.toFixed(1)}° above horizon`}</title>
            <circle r="20" fill="transparent" className="hit-area" />
            <circle
              r={radius * 2}
              fill={o.color}
              opacity=".22"
              filter="url(#star-glow)"
            />
            {active && (
              <>
                <circle r={radius + 10} className="selection-ring" />
                <path
                  d={`M 0 ${-radius - 15} v -4 M 0 ${radius + 15} v 4 M ${-radius - 15} 0 h -4 M ${radius + 15} 0 h 4`}
                  stroke="#cbb78d"
                  strokeWidth=".7"
                  opacity=".7"
                />
              </>
            )}
            {moon ? (
              <MoonDisc phase={o.phase!} size={radius} />
            ) : (
              <>
                <circle r={radius} fill={o.color} />
                <circle r={radius * 0.4} fill="#fff9ee" opacity=".7" />
              </>
            )}
            {labels && (
              <text
                x={left ? -radius - 15 : radius + 15}
                y={4}
                textAnchor={left ? "end" : "start"}
                className={`star-label ${active ? "active" : ""}`}
              >
                {o.name}
              </text>
            )}
          </g>
        );
      })}
      {visible.length === 0 && (
        <text x="320" y="365" textAnchor="middle" className="star-label">
          No objects above horizon.
        </text>
      )}
    </svg>
  );
}

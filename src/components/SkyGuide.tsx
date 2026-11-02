import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Compass, LocateFixed } from "lucide-react";
import type { Place } from "../lib/catalog";
import { calculateSky, compass } from "../lib/sky";
import {
  absoluteAngles,
  deviceView,
  manualView,
  projectInView,
  viewDirection,
  wrap,
  type CompassEvent,
} from "../lib/guide";
import Dialog from "./Dialog";

export default function SkyGuide({
  place,
  onClose,
}: {
  place: Place;
  onClose: () => void;
}) {
  const [livePlace, setLivePlace] = useState(place);
  const [now, setNow] = useState(Date.now);
  const objects = useMemo(() => calculateSky(now, livePlace), [now, livePlace]);
  const [targetId, setTargetId] = useState(
    () => [...objects].sort((a, b) => b.altitude - a.altitude)[0].id,
  );
  const target = objects.find((o) => o.id === targetId)!;
  const [azimuth, setAzimuth] = useState(target.azimuth);
  const [altitude, setAltitude] = useState(Math.max(0, target.altitude));
  const [tracking, setTracking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [angles, setAngles] = useState<{
    alpha: number;
    beta: number;
    gamma: number;
  } | null>(null);
  const [screenAngle, setScreenAngle] = useState(
    window.screen.orientation?.angle ?? 0,
  );
  const [correction, setCorrection] = useState(0);
  const [fov, setFov] = useState(65);
  const [aspect, setAspect] = useState(0.8);
  const [message, setMessage] = useState("");
  const [cameraMessage, setCameraMessage] = useState("");
  const [camera, setCamera] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const cameraAttempt = useRef(0);
  const lastReading = useRef(0);
  const view =
    tracking && angles
      ? deviceView(
          angles.alpha,
          angles.beta,
          angles.gamma,
          screenAngle,
          correction,
        )
      : manualView(azimuth, altitude);
  const facing = viewDirection(view);
  const aim = projectInView(target.azimuth, target.altitude, view, aspect, fov);
  const turn = ((target.azimuth - facing.azimuth + 540) % 360) - 180;
  const tilt = target.altitude - facing.altitude;

  function stopCamera() {
    cameraAttempt.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCamera(false);
    setCameraBusy(false);
  }
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const observer = new ResizeObserver(([entry]) =>
      setAspect(entry.contentRect.width / entry.contentRect.height),
    );
    observer.observe(stage.current!);
    const resize = () =>
      setScreenAngle(
        window.screen.orientation?.angle ??
          (Number((window as Window & { orientation?: number }).orientation) ||
            0),
      );
    window.addEventListener("orientationchange", resize);
    window.addEventListener("resize", resize);
    const hidden = () => {
      if (document.hidden) {
        stopCamera();
        setTracking(false);
        setAngles(null);
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      mounted.current = false;
      cameraAttempt.current++;
      clearInterval(timer);
      observer.disconnect();
      stream.current?.getTracks().forEach((track) => track.stop());
      window.removeEventListener("orientationchange", resize);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  useEffect(() => {
    if (!tracking) return;
    lastReading.current = Date.now();
    let received = false;
    const handle = (event: DeviceOrientationEvent) => {
      const next = absoluteAngles(event as CompassEvent);
      if (!next) return;
      const time = Date.now();
      if (received && time - lastReading.current < 40) return;
      received = true;
      lastReading.current = time;
      setAngles(next);
      setMessage("");
    };
    window.addEventListener("deviceorientationabsolute", handle);
    window.addEventListener("deviceorientation", handle);
    const timer = setInterval(() => {
      if (Date.now() - lastReading.current > 4000) {
        setTracking(false);
        setAngles(null);
        setMessage(
          "A compass reading is unavailable. Use the manual direction controls below.",
        );
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("deviceorientationabsolute", handle);
      window.removeEventListener("deviceorientation", handle);
    };
  }, [tracking]);
  useEffect(() => {
    if (camera && video.current && stream.current) {
      const playingStream = stream.current;
      video.current.srcObject = playingStream;
      void video.current.play().catch(() => {
        if (mounted.current && stream.current === playingStream) {
          stopCamera();
          setCameraMessage(
            "The camera could not play. You can continue with the sky guide.",
          );
        }
      });
    }
  }, [camera]);

  async function followPhone() {
    if (tracking) {
      setTracking(false);
      setAngles(null);
      return;
    }
    setMessage("");
    if (
      !window.isSecureContext ||
      typeof DeviceOrientationEvent === "undefined"
    ) {
      setMessage(
        "Phone direction is unavailable here. Use the manual controls below.",
      );
      return;
    }
    setRequesting(true);
    try {
      const api = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: (absolute?: boolean) => Promise<string>;
      };
      if (
        api.requestPermission &&
        (await api.requestPermission(true)) !== "granted"
      )
        throw new Error("denied");
      if (!mounted.current || document.hidden) return;
      setAngles(null);
      setTracking(true);
      setMessage("Waiting for your phone’s compass…");
    } catch {
      if (mounted.current)
        setMessage(
          "Motion permission was unavailable. Use the manual direction controls below.",
        );
    } finally {
      if (mounted.current) setRequesting(false);
    }
  }
  async function toggleCamera() {
    if (camera || cameraBusy) {
      stopCamera();
      return;
    }
    setCameraMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage(
        "Camera access is unavailable here. The sky guide still works.",
      );
      return;
    }
    const attempt = ++cameraAttempt.current;
    setCameraBusy(true);
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      if (
        !mounted.current ||
        attempt !== cameraAttempt.current ||
        document.hidden
      ) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = next;
      next.getVideoTracks().forEach((track) =>
        track.addEventListener("ended", () => {
          if (mounted.current && stream.current === next) {
            stopCamera();
            setCameraMessage(
              "Camera disconnected. You can continue with the sky guide.",
            );
          }
        }),
      );
      setCamera(true);
    } catch {
      if (mounted.current && attempt === cameraAttempt.current)
        setCameraMessage(
          "Camera permission was unavailable. You can continue with the sky guide.",
        );
    } finally {
      if (mounted.current && attempt === cameraAttempt.current)
        setCameraBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setMessage(
        "Location is unavailable. The guide uses your selected place.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!mounted.current) return;
        setLivePlace({
          ...place,
          lat: coords.latitude,
          lon: coords.longitude,
          label: "Current location",
        });
        setLocating(false);
        setMessage("");
      },
      () => {
        if (!mounted.current) return;
        setLocating(false);
        setMessage(
          "Location permission was unavailable. The guide uses your selected place.",
        );
      },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true },
    );
  }

  return (
    <Dialog title="Sky guide" onClose={onClose}>
      <p className="guide-intro">
        Point your phone at the sky. This live view uses the current time; your
        map stays at its selected moment.
      </p>
      <div className="guide-place">
        <span>
          <i /> Live · {livePlace.label}
        </span>
        <button onClick={locate} disabled={locating}>
          <LocateFixed size={14} />
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>
      <div
        className={`guide-stage${camera ? " with-camera" : ""}`}
        ref={stage}
        aria-label="Live sky direction view"
      >
        {camera && (
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            aria-label="Live rear camera"
          />
        )}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="guide-overlay"
          aria-label="Objects in your viewing direction"
        >
          <path d="M47 50h6M50 47v6" className="guide-crosshair" />
          {objects
            .filter((o) => o.altitude >= 0)
            .map((o) => {
              const p = projectInView(o.azimuth, o.altitude, view, aspect, fov);
              return p?.visible ? (
                <g key={o.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={o.id === targetId ? 1.2 : 0.65}
                    fill={o.color}
                  />
                </g>
              ) : null;
            })}
        </svg>
        {objects
          .filter((o) => o.altitude >= 0)
          .map((o) => {
            const p = projectInView(o.azimuth, o.altitude, view, aspect, fov);
            return p?.visible ? (
              <button
                className={`guide-star${o.id === targetId ? " selected" : ""}`}
                key={o.id}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onClick={() => setTargetId(o.id)}
                aria-label={`Find ${o.name}`}
              >
                <span>{o.name}</span>
              </button>
            ) : null;
          })}
        <div className="guide-bearing">
          {compass(facing.azimuth)} {Math.round(facing.azimuth)}°{" "}
          <span>· {Math.round(facing.altitude)}° up</span>
        </div>
        {!camera && (
          <span className="guide-mode">
            {tracking && angles ? "Following phone" : "Manual view"}
          </span>
        )}
        <p className="guide-aim" role="status">
          {target.altitude < 0
            ? `${target.name} is below the horizon.`
            : aim?.visible
              ? `${target.name} is in view`
              : `${target.name}: ${Math.abs(turn) > 5 ? `turn ${turn > 0 ? "right" : "left"} ${Math.round(Math.abs(turn))}°` : "keep this direction"}${Math.abs(tilt) > 5 ? ` · ${tilt > 0 ? "tilt up" : "tilt down"} ${Math.round(Math.abs(tilt))}°` : ""}`}
        </p>
      </div>
      <div className="guide-actions">
        <button
          className="guide-follow"
          aria-pressed={tracking}
          disabled={requesting}
          onClick={followPhone}
        >
          <Compass size={15} />
          {requesting
            ? "Requesting…"
            : tracking
              ? "Stop following"
              : "Follow phone"}
        </button>
        <button onClick={toggleCamera} aria-pressed={camera}>
          {camera || cameraBusy ? (
            <CameraOff size={15} />
          ) : (
            <Camera size={15} />
          )}
          {cameraBusy ? "Cancel camera" : camera ? "Camera off" : "Camera"}
        </button>
      </div>
      <label className="guide-target">
        Find an object
        <select
          aria-label="Guide target"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        >
          {objects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.altitude < 0 ? " · below horizon" : ""}
            </option>
          ))}
        </select>
      </label>
      {(message || cameraMessage) && (
        <p className="field-note" role="status">
          {message} {cameraMessage}
        </p>
      )}
      {!tracking && (
        <div className="guide-manual">
          <label>
            Direction · {Math.round(azimuth)}° {compass(azimuth)}
            <input
              aria-label="Guide direction"
              type="range"
              min="0"
              max="359"
              value={azimuth}
              onChange={(e) => setAzimuth(Number(e.target.value))}
            />
          </label>
          <label>
            Tilt · {Math.round(altitude)}°
            <input
              aria-label="Guide tilt"
              type="range"
              min="-90"
              max="90"
              value={altitude}
              onChange={(e) => setAltitude(Number(e.target.value))}
            />
          </label>
          <button
            onClick={() => {
              setAzimuth(wrap(target.azimuth));
              setAltitude(Math.max(0, target.altitude));
            }}
          >
            Look toward {target.name}
          </button>
        </div>
      )}
      <details className="guide-adjust">
        <summary>Adjust alignment</summary>
        <p className="field-note">
          Compass readings can drift. Align a known object, then adjust the
          direction and zoom. Keep the phone away from magnets. Labels are a
          guide to calculated positions.
        </p>
        <label>
          Compass correction · {correction}°
          <input
            aria-label="Compass correction"
            type="range"
            min="-180"
            max="180"
            value={correction}
            disabled={!tracking}
            onChange={(e) => setCorrection(Number(e.target.value))}
          />
        </label>
        <label>
          Vertical field of view · {fov}°
          <input
            aria-label="Vertical field of view"
            type="range"
            min="30"
            max="100"
            value={fov}
            onChange={(e) => setFov(Number(e.target.value))}
          />
        </label>
      </details>
      <p className="field-note">
        Eight bright stars and the Moon. Daylight, clouds and buildings can hide
        them. Camera images stay on your device. Camera and motion stop when you
        close this view or leave the tab.
      </p>
    </Dialog>
  );
}

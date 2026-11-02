type Vector = [number, number, number];
export interface ViewBasis {
  right: Vector;
  up: Vector;
  forward: Vector;
}
const rad = Math.PI / 180;
const dot = (a: Vector, b: Vector) =>
  a.reduce((sum, v, i) => sum + v * b[i], 0);
export const wrap = (angle: number) => ((angle % 360) + 360) % 360;

export function direction(azimuth: number, altitude: number): Vector {
  const a = azimuth * rad,
    h = altitude * rad;
  return [Math.sin(a) * Math.cos(h), Math.cos(a) * Math.cos(h), Math.sin(h)];
}
export function manualView(azimuth: number, altitude: number): ViewBasis {
  return {
    forward: direction(azimuth, altitude),
    right: direction(azimuth + 90, 0),
    up: direction(azimuth + 180, 90 - altitude),
  };
}

// W3C intrinsic Z-X-Y rotation, with ENU world axes. The rear camera looks
// along device -Z. Rotate the screen axes too, preserving roll in landscape.
export function deviceView(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle = 0,
  correction = 0,
): ViewBasis {
  const a = (alpha - correction) * rad,
    b = beta * rad,
    g = gamma * rad;
  const rotate = ([x, y, z]: Vector): Vector => {
    const x1 = x * Math.cos(g) + z * Math.sin(g);
    const z1 = -x * Math.sin(g) + z * Math.cos(g);
    const y2 = y * Math.cos(b) - z1 * Math.sin(b);
    const z2 = y * Math.sin(b) + z1 * Math.cos(b);
    return [
      x1 * Math.cos(a) - y2 * Math.sin(a),
      x1 * Math.sin(a) + y2 * Math.cos(a),
      z2,
    ];
  };
  const s = screenAngle * rad;
  return {
    right: rotate([Math.cos(s), -Math.sin(s), 0]),
    up: rotate([Math.sin(s), Math.cos(s), 0]),
    forward: rotate([0, 0, -1]),
  };
}

export function viewDirection(view: ViewBasis) {
  return {
    azimuth: wrap(Math.atan2(view.forward[0], view.forward[1]) / rad),
    altitude: Math.asin(Math.max(-1, Math.min(1, view.forward[2]))) / rad,
  };
}

export function projectInView(
  azimuth: number,
  altitude: number,
  view: ViewBasis,
  aspect: number,
  fov = 65,
) {
  const v = direction(azimuth, altitude),
    depth = dot(v, view.forward);
  if (depth <= 0.001) return null;
  const scale = Math.tan((fov * rad) / 2);
  const x = dot(v, view.right) / (depth * scale * aspect);
  const y = dot(v, view.up) / (depth * scale);
  return {
    x: (x + 1) * 50,
    y: (1 - y) * 50,
    visible: Math.abs(x) <= 0.9 && Math.abs(y) <= 0.9,
  };
}

export type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};
export function absoluteAngles(event: CompassEvent) {
  const { alpha, beta, gamma } = event;
  if (
    beta === null ||
    gamma === null ||
    !Number.isFinite(beta) ||
    !Number.isFinite(gamma)
  )
    return null;
  if (
    typeof event.webkitCompassHeading === "number" &&
    Number.isFinite(event.webkitCompassHeading) &&
    (event.webkitCompassAccuracy === undefined ||
      event.webkitCompassAccuracy >= 0)
  ) {
    return { alpha: wrap(360 - event.webkitCompassHeading), beta, gamma };
  }
  if (
    (event.absolute || event.type === "deviceorientationabsolute") &&
    alpha !== null &&
    Number.isFinite(alpha)
  )
    return { alpha, beta, gamma };
  return null;
}

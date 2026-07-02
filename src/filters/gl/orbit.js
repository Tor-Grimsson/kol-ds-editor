// Shared orbit-camera math: spherical (yaw, pitch, dist) → cartesian eye.
// yaw/pitch in RADIANS, dist in world units, optional target offset (default
// origin). y-up: yaw rotates around y, pitch lifts toward +y. Copied from
// kol-labs-single src/lib/orbit.js for the ScanEngine port.
export function orbitEye(yaw, pitch, dist, target = [0, 0, 0]) {
  const cp = Math.cos(pitch)
  return [
    target[0] + dist * cp * Math.sin(yaw),
    target[1] + dist * Math.sin(pitch),
    target[2] + dist * cp * Math.cos(yaw),
  ]
}

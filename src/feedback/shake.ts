// Schüttel-Erkennung über den Bewegungssensor (devicemotion)

export interface ShakeOptions {
  /** Beschleunigung ohne Erdanziehung, ab der ein Ausschlag zählt, in m/s² */
  threshold: number
  /** So viele Ausschläge müssen es innerhalb von windowMs sein */
  peaks: number
  windowMs: number
  /** Mindestabstand zweier Ausschläge (eine Bewegung liefert viele Messwerte) */
  peakGapMs: number
  /** Nach einem Schütteln so lange nichts melden */
  cooldownMs: number
}

// Kräftiges Hin-und-her-Schütteln; Gehen, Autofahren oder Ablegen erreichen das nicht wiederholt.
export const DEFAULT_SHAKE_OPTIONS: ShakeOptions = {
  threshold: 15,
  peaks: 4,
  windowMs: 1500,
  peakGapMs: 120,
  cooldownMs: 3000,
}

/** Liefert eine Funktion, die je Messwert (Betrag der Beschleunigung, Zeit in ms) meldet, ob geschüttelt wurde. */
export function createShakeDetector(options: ShakeOptions = DEFAULT_SHAKE_OPTIONS) {
  let peakTimes: number[] = []
  let lastShake = -Infinity

  return (magnitude: number, time: number): boolean => {
    if (magnitude < options.threshold || time - lastShake < options.cooldownMs) return false
    const lastPeak = peakTimes.at(-1)
    if (lastPeak !== undefined && time - lastPeak < options.peakGapMs) return false
    peakTimes = [...peakTimes.filter((t) => time - t <= options.windowMs), time]
    if (peakTimes.length < options.peaks) return false
    peakTimes = []
    lastShake = time
    return true
  }
}

const GRAVITY = 9.81

/** Betrag der Beschleunigung ohne Erdanziehung; manche Geräte liefern nur den Wert mit Erdanziehung. */
export function motionMagnitude(event: Pick<DeviceMotionEvent, 'acceleration' | 'accelerationIncludingGravity'>) {
  const length = (v: DeviceMotionEventAcceleration | null) =>
    v && v.x !== null && v.y !== null && v.z !== null ? Math.hypot(v.x, v.y, v.z) : undefined
  const withoutGravity = length(event.acceleration)
  if (withoutGravity !== undefined) return withoutGravity
  const withGravity = length(event.accelerationIncludingGravity)
  return withGravity === undefined ? 0 : Math.abs(withGravity - GRAVITY)
}

type PermissionRequest = () => Promise<'granted' | 'denied'>

/** iPhone/iPad: Der Sensor muss nach einem Antippen erst freigegeben werden. */
function permissionRequest(): PermissionRequest | undefined {
  if (typeof DeviceMotionEvent === 'undefined') return undefined
  const request = (DeviceMotionEvent as unknown as { requestPermission?: PermissionRequest }).requestPermission
  return typeof request === 'function' ? request.bind(DeviceMotionEvent) : undefined
}

export function needsMotionPermission(): boolean {
  return permissionRequest() !== undefined
}

/** Nur aus einem Klick/Tipp heraus aufrufen. Ohne Freigabe-Pflicht sofort true. */
export async function requestMotionPermission(): Promise<boolean> {
  const request = permissionRequest()
  if (!request) return true
  try {
    return (await request()) === 'granted'
  } catch {
    return false
  }
}

export function supportsMotion(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
}

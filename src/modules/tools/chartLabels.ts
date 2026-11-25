// Beschriftungen in Diagrammen so platzieren, dass sie keine Linien und keine anderen Beschriftungen überdecken.
// Reine Geometrie in SVG-Koordinaten, keine Fachinhalte.

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export type Point = [number, number]

export interface LabelRequest {
  /** Punkt, zu dem die Beschriftung gehört */
  at: Point
  width: number
  height: number
}

export interface PlacedLabel {
  box: Box
  /** Ende der Hinweislinie am Rand der Beschriftung; null, wenn die Beschriftung direkt am Punkt sitzt */
  leaderEnd: Point | null
}

/** Schneidet die Strecke a–b das Rechteck? (Liang-Barsky) */
export function segmentHitsBox(a: Point, b: Point, box: Box): boolean {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  let from = 0
  let to = 1
  const edges: [number, number][] = [
    [-dx, a[0] - box.x],
    [dx, box.x + box.width - a[0]],
    [-dy, a[1] - box.y],
    [dy, box.y + box.height - a[1]],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) from = Math.max(from, t)
    else to = Math.min(to, t)
    if (from > to) return false
  }
  return true
}

const grow = (box: Box, margin: number): Box => ({
  x: box.x - margin,
  y: box.y - margin,
  width: box.width + 2 * margin,
  height: box.height + 2 * margin,
})

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** Nächster Punkt auf dem Rand des Rechtecks */
function nearestOnBox(point: Point, box: Box): Point {
  return [Math.min(Math.max(point[0], box.x), box.x + box.width), Math.min(Math.max(point[1], box.y), box.y + box.height)]
}

// Richtungen in der Reihenfolge, in der sie probiert werden: zuerst oben rechts, dann rundherum
const DIRECTIONS: Point[] = [
  [1, -1],
  [1, 0],
  [1, 1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]
const DISTANCES = [10, 18, 28, 40, 54, 70, 90]

function candidateBox(request: LabelRequest, [dirX, dirY]: Point, distance: number): Box {
  const [px, py] = request.at
  const x = dirX > 0 ? px + distance : dirX < 0 ? px - distance - request.width : px - request.width / 2
  const y = dirY > 0 ? py + distance : dirY < 0 ? py - distance - request.height : py - request.height / 2
  return { x, y, width: request.width, height: request.height }
}

/**
 * Platziert die Beschriftungen nacheinander: je Beschriftung die nächstgelegene Position im Zeichenbereich, die keine
 * Linie, keinen Punkt und keine schon platzierte Beschriftung berührt. Gibt es keine, gewinnt die mit den wenigsten
 * Berührungen. Hinweislinien zählen ebenfalls als Hindernis für spätere Beschriftungen.
 */
export function placeLabels(
  requests: readonly LabelRequest[],
  options: { area: Box; lines: readonly Point[][]; points: readonly Point[]; margin?: number; pointRadius?: number },
): PlacedLabel[] {
  const margin = options.margin ?? 3
  const radius = options.pointRadius ?? 7
  const lines: Point[][] = options.lines.map((line) => [...line])
  const placed: PlacedLabel[] = []
  const inside = (box: Box) =>
    box.x >= options.area.x &&
    box.y >= options.area.y &&
    box.x + box.width <= options.area.x + options.area.width &&
    box.y + box.height <= options.area.y + options.area.height

  for (const request of requests) {
    let best: { label: PlacedLabel; hits: number } | null = null
    for (const distance of DISTANCES) {
      for (const direction of DIRECTIONS) {
        const box = candidateBox(request, direction, distance)
        if (!inside(box)) continue
        const padded = grow(box, margin)
        let hits = 0
        for (const line of lines) {
          for (let index = 1; index < line.length; index++) if (segmentHitsBox(line[index - 1]!, line[index]!, padded)) hits++
        }
        for (const point of options.points) if (overlaps(padded, { x: point[0] - radius, y: point[1] - radius, width: 2 * radius, height: 2 * radius })) hits++
        for (const other of placed) if (overlaps(padded, other.box)) hits += 10
        const end = nearestOnBox(request.at, box)
        const leaderEnd: Point | null = Math.hypot(end[0] - request.at[0], end[1] - request.at[1]) > radius + 2 ? end : null
        // Die Hinweislinie darf keine schon platzierte Beschriftung kreuzen
        if (leaderEnd) for (const other of placed) if (segmentHitsBox(request.at, leaderEnd, other.box)) hits += 10
        if (!best || hits < best.hits) best = { label: { box, leaderEnd }, hits }
        if (hits === 0) break
      }
      if (best?.hits === 0) break
    }
    const label = best?.label ?? { box: candidateBox(request, DIRECTIONS[0]!, DISTANCES[0]!), leaderEnd: null }
    placed.push(label)
    if (label.leaderEnd) lines.push([request.at, label.leaderEnd])
  }
  return placed
}

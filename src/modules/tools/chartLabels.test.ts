import { describe, expect, it } from 'vitest'
import { placeLabels, segmentHitsBox, type Box, type Point } from './chartLabels'

const area: Box = { x: 0, y: 0, width: 300, height: 200 }

const lineHits = (box: Box, line: Point[]) => line.some((point, index) => index > 0 && segmentHitsBox(line[index - 1]!, point, box))

describe('Diagramm-Beschriftungen', () => {
  it('Strecke und Rechteck: Treffer und Vorbeigehen', () => {
    const box: Box = { x: 10, y: 10, width: 20, height: 10 }
    expect(segmentHitsBox([0, 15], [50, 15], box)).toBe(true)
    expect(segmentHitsBox([0, 0], [50, 5], box)).toBe(false)
    expect(segmentHitsBox([15, 12], [16, 13], box)).toBe(true)
  })

  it('weicht einer Linie aus, die durch die bevorzugte Position läuft', () => {
    // Diagonale von unten links nach oben rechts direkt durch den Bereich oben rechts vom Punkt
    const line: Point[] = [
      [0, 200],
      [300, 0],
    ]
    const [label] = placeLabels([{ at: [150, 100], width: 80, height: 18 }], { area, lines: [line], points: [] })
    expect(lineHits(label!.box, line)).toBe(false)
    expect(label!.leaderEnd).not.toBeNull()
  })

  it('zwei Beschriftungen überlappen sich nicht und bleiben im Bereich', () => {
    const placed = placeLabels(
      [
        { at: [100, 100], width: 120, height: 18 },
        { at: [110, 105], width: 120, height: 18 },
      ],
      { area, lines: [], points: [] },
    )
    const [a, b] = placed.map((label) => label.box)
    const overlap = a!.x < b!.x + b!.width && b!.x < a!.x + a!.width && a!.y < b!.y + b!.height && b!.y < a!.y + a!.height
    expect(overlap).toBe(false)
    for (const box of [a!, b!]) {
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(300)
    }
  })
})

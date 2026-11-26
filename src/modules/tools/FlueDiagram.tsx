import { useId, useState, type ReactNode } from 'react'

// Schematische Schnittzeichnung je Grundart nach DIN EN 1749 (eigene Darstellung, nicht maßstäblich).
// Die Zeichnung zeigt nur, was die Definition der Art festlegt: woher die Luft kommt, wohin das Abgas geht,
// welche Leitungen zum Gerät gehören (dunkel) und welche zum Gebäude (grau), dazu Strömungssicherung und
// Lage des Gebläses aus der letzten Ziffer. Alles Weitere (Maße, Abstände) regeln TRGI und Hersteller.

const INK = 'var(--ink)'
const SURFACE = 'var(--surface)'
const BUILDING = 'var(--raised)'
const BUILDING_LINE = 'var(--line)'
const AIR = 'var(--graph-1)'
const FLUE = 'var(--graph-2)'
const LABEL = 'var(--muted)'

type Medium = 'air' | 'flue'

interface Scene {
  /** Gebläse-Ziffer, bestimmt die Lage des Gebläses */
  digit: string | undefined
  marker: (medium: Medium) => string
}

/** Leichte Tönung je Medium, damit man den Weg von Luft und Abgas verfolgen kann (hell und dunkel lesbar) */
const TINT: Record<Medium, string> = {
  air: 'color-mix(in srgb, var(--graph-1) 35%, var(--surface))',
  flue: 'color-mix(in srgb, var(--graph-2) 35%, var(--surface))',
}
/** Kräftiger für die schmale Füllung der Rohre */
const PIPE_TINT: Record<Medium, string> = {
  air: 'color-mix(in srgb, var(--graph-1) 65%, var(--surface))',
  flue: 'color-mix(in srgb, var(--graph-2) 65%, var(--surface))',
}

// ---------- Bausteine ----------

/**
 * Rohr: dunkel = gehört zum Gerät, grau = Gebäude oder separat zugelassen. Innen getönt nach dem, was darin strömt;
 * ohne medium neutral (z. B. bei gemischten oder offenen Wegen).
 */
function Pipe({ d, medium, building = false, dashed = false }: { d: string; medium?: Medium; building?: boolean; dashed?: boolean }) {
  const dash = dashed ? '6 4' : undefined
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke={building ? BUILDING_LINE : INK} strokeWidth={7} strokeDasharray={dash} />
      <path d={d} stroke={medium ? PIPE_TINT[medium] : building ? BUILDING : SURFACE} strokeWidth={4} strokeDasharray={dash} />
    </g>
  )
}

/** Konzentrisches Luft-Abgas-Rohr: außen Luft (Ringspalt blau getönt), innen Abgas (orange getönt) */
function Concentric({ d }: { d: string }) {
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke={INK} strokeWidth={13} />
      <path d={d} stroke={PIPE_TINT.air} strokeWidth={9} />
      <path d={d} stroke={INK} strokeWidth={5} />
      <path d={d} stroke={PIPE_TINT.flue} strokeWidth={2.5} />
    </g>
  )
}

/** Schacht oder Abgasanlage des Gebäudes; getönt nach dem, was darin strömt (ohne medium: Bauteil bzw. gemischt) */
const Shaft = ({ x, y, w, h, medium }: { x: number; y: number; w: number; h: number; medium?: Medium }) => (
  <rect x={x} y={y} width={w} height={h} fill={medium ? TINT[medium] : BUILDING} stroke={BUILDING_LINE} strokeWidth={1.5} />
)

function Flow({ scene, medium, x1, y1, x2, y2 }: { scene: Scene; medium: Medium } & Record<'x1' | 'y1' | 'x2' | 'y2', number>) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={medium === 'air' ? AIR : FLUE}
      strokeWidth={2.5}
      markerEnd={`url(#${scene.marker(medium)})`}
    />
  )
}

/** Mündung: Haube über einem senkrechten Rohrende oder Endstück an der Wand */
function Cap({ x, y, dir, building = false }: { x: number; y: number; dir: 'up' | 'left'; building?: boolean }) {
  const stroke = building ? BUILDING_LINE : INK
  return dir === 'up' ? (
    <path d={`M ${x - 11} ${y + 1} L ${x} ${y - 6} L ${x + 11} ${y + 1}`} fill="none" stroke={stroke} strokeWidth={3} />
  ) : (
    <line x1={x} y1={y - 10} x2={x} y2={y + 10} stroke={stroke} strokeWidth={3} />
  )
}

function Label({ x, y, children, anchor = 'start' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} fontSize={10.5} fill={LABEL} textAnchor={anchor} stroke={SURFACE} strokeWidth={3} paintOrder="stroke">
      {children}
    </text>
  )
}

function Fan({ x, y }: { x: number; y: number }) {
  return (
    <g aria-label="Gebläse">
      <circle cx={x} cy={y} r={6.5} fill={SURFACE} stroke={INK} strokeWidth={1.5} />
      <path
        d={`M ${x} ${y} L ${x - 1.5} ${y - 5.5} L ${x + 1.5} ${y - 5.5} Z M ${x} ${y} L ${x + 5} ${y + 2.5} L ${x + 3.5} ${y + 5} Z M ${x} ${y} L ${x - 5} ${y + 2.5} L ${x - 3.5} ${y + 5} Z`}
        fill={INK}
      />
    </g>
  )
}

/** Strömungssicherung: Haube mit seitlichen Öffnungen, durch die Raumluft nachströmt */
function Diverter({ scene, x, y }: { scene: Scene; x: number; y: number }) {
  return (
    <g aria-label="Strömungssicherung">
      <path d={`M ${x - 4} ${y} L ${x - 4} ${y - 4} L ${x - 14} ${y - 10} L ${x - 14} ${y - 18} L ${x - 4} ${y - 24}`} fill="none" stroke={INK} strokeWidth={2.5} />
      <path d={`M ${x + 4} ${y} L ${x + 4} ${y - 4} L ${x + 14} ${y - 10} L ${x + 14} ${y - 18} L ${x + 4} ${y - 24}`} fill="none" stroke={INK} strokeWidth={2.5} />
      <Flow scene={scene} medium="air" x1={x - 30} y1={y - 5} x2={x - 17} y2={y - 5} />
    </g>
  )
}

/** Höhe, die Strömungssicherung und Gebläse 4 über dem Gerät belegen */
const stackHeight = (diverter: boolean, digit: string | undefined) => (diverter ? (digit === '4' ? 44 : 26) : 0)

/** Teile über dem Gerät: Strömungssicherung, darüber ggf. Gebläse hinter der Strömungssicherung */
function FlueStack({ scene, cx, y, diverter }: { scene: Scene; cx: number; y: number; diverter: boolean }) {
  if (!diverter) return null
  return (
    <>
      <Diverter scene={scene} x={cx} y={y} />
      {scene.digit === '4' && (
        <>
          <Pipe d={`M ${cx} ${y - 24} V ${y - 44}`} medium="flue" />
          <Fan x={cx} y={y - 34} />
        </>
      )}
      <Label x={cx + 18} y={y - 10}>
        Strömungssicherung
      </Label>
    </>
  )
}

/** Gerät mit Brenner, Wärmetauscher und Gebläse nach Ziffer 2 (hinter dem Wärmetauscher) oder 3 (vor dem Brenner) */
function Appliance({ scene, x, y, w = 64, h = 70, sealed, airTop = sealed, label = 'Gerät' }: { scene: Scene; x: number; y: number; w?: number; h?: number; sealed: boolean; /** Luft tritt oben ein */ airTop?: boolean; label?: string }) {
  const cx = x + w / 2
  const zig = Array.from({ length: 5 }, (_, i) => `L ${x + 10 + ((w - 20) * (i + 0.5)) / 5} ${y + h / 2 + (i % 2 === 0 ? -5 : 5)}`).join(' ')
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={SURFACE} stroke={INK} strokeWidth={2} />
      {sealed && <rect x={x + 3.5} y={y + 3.5} width={w - 7} height={h - 7} rx={2} fill="none" stroke={INK} strokeWidth={1} />}
      {/* Wärmetauscher */}
      <path d={`M ${x + 10} ${y + h / 2} ${zig} L ${x + w - 10} ${y + h / 2}`} fill="none" stroke={INK} strokeWidth={1.5} />
      {/* Brenner mit Flamme */}
      <line x1={cx - 12} y1={y + h - 9} x2={cx + 12} y2={y + h - 9} stroke={INK} strokeWidth={2} />
      <path d={`M ${cx - 6} ${y + h - 10} Q ${cx - 7} ${y + h - 18} ${cx} ${y + h - 24} Q ${cx + 7} ${y + h - 18} ${cx + 6} ${y + h - 10} Z`} fill={FLUE} />
      {scene.digit === '2' && <Fan x={cx} y={y + 11} />}
      {scene.digit === '3' && <Fan x={x + 11} y={airTop ? y + 13 : y + h - 13} />}
      {label && (
        <text x={x - 4} y={y + 10} fontSize={8.5} fill={LABEL} textAnchor="end">
          {label}
        </text>
      )}
    </g>
  )
}

/** Gebäudeschnitt: außen links, Außenwand, Dach oben, Boden unten; optional Zwischendecke oder Dachboden */
function Building({ floors = 1, loft = false, outsideLabel = true }: { floors?: 1 | 2; loft?: boolean; outsideLabel?: boolean }) {
  return (
    <g>
      {loft ? (
        <>
          <Shaft x={40} y={40} w={12} h={20} />
          <Shaft x={40} y={100} w={12} h={192} />
          <Shaft x={52} y={110} w={308} h={8} />
        </>
      ) : (
        <Shaft x={40} y={40} w={12} h={252} />
      )}
      <Shaft x={40} y={40} w={320} h={10} />
      <Shaft x={40} y={282} w={320} h={10} />
      {floors === 2 && <Shaft x={52} y={160} w={308} h={8} />}
      {outsideLabel && (
        <Label x={4} y={34}>
          außen
        </Label>
      )}
    </g>
  )
}

// ---------- Anordnungen je Grundart ----------

type Layout = (scene: Scene) => ReactNode

/** Raumluftabhängig: Luft strömt aus dem Raum unten ins Gerät */
const roomAir = (scene: Scene, x: number, y: number, h: number, top = false) =>
  top ? (
    <>
      <Flow scene={scene} medium="air" x1={x - 40} y1={y - 24} x2={x + 2} y2={y - 2} />
      <Label x={x - 50} y={y - 30}>
        Luft aus dem Raum
      </Label>
    </>
  ) : (
    <>
      <Flow scene={scene} medium="air" x1={x - 44} y1={y + h - 8} x2={x - 4} y2={y + h - 8} />
      <Label x={x - 46} y={y + h + 10}>
        Luft aus dem Raum
      </Label>
    </>
  )

/** Gebläsegeräte ohne Strömungssicherung saugen die Raumluft oben an, atmosphärische Geräte unten am Brenner */
const fanAirTop = (diverter: boolean, digit: string | undefined) => !diverter && (digit === '2' || digit === '3')

/** Beschriftung von Gebäudeteilen über dem Dach, rechtsbündig bis kurz vor den Schacht */
const BuildingLabel = ({ x, lines }: { x: number; lines: string[] }) => (
  <>
    {lines.map((line, index) => (
      <Label key={line} x={x} y={32 - 12 * (lines.length - 1 - index)} anchor="end">
        {line}
      </Label>
    ))}
  </>
)

/** B1/B2: Gerät ohne eigene Abgasleitung, an Abgasanlage des Gebäudes */
const bSeparate = (diverter: boolean): Layout => (scene) => {
  const top = 190 - stackHeight(diverter, scene.digit)
  return (
    <>
      <Building />
      <Shaft x={300} y={8} w={30} h={274} medium="flue" />
      <Pipe d={`M 182 ${top} V 110 H 300`} building medium="flue" />
      <FlueStack scene={scene} cx={182} y={190} diverter={diverter} />
      <Appliance scene={scene} x={150} y={190} sealed={false} airTop={fanAirTop(diverter, scene.digit)} />
      {roomAir(scene, 150, 190, 70, fanAirTop(diverter, scene.digit))}
      <Flow scene={scene} medium="flue" x1={200} y1={98} x2={280} y2={98} />
      <Flow scene={scene} medium="flue" x1={315} y1={60} x2={315} y2={4} />
      <Label x={240} y={128} anchor="middle">
        Verbindungsstück
      </Label>
      <BuildingLabel x={294} lines={['Abgasanlage mit Verbindungsstück', '(Gebäude, separat zugelassen)']} />
    </>
  )
}

/** B4/B5: eigene Abgasleitung bis zur Mündung */
const bOwn = (diverter: boolean): Layout => (scene) => {
  const top = 190 - stackHeight(diverter, scene.digit)
  return (
    <>
      <Building />
      <Pipe d={`M 182 ${top} V 16`} medium="flue" />
      <Cap x={182} y={14} dir="up" />
      <FlueStack scene={scene} cx={182} y={190} diverter={diverter} />
      <Appliance scene={scene} x={150} y={190} sealed={false} airTop={fanAirTop(diverter, scene.digit)} />
      {roomAir(scene, 150, 190, 70, fanAirTop(diverter, scene.digit))}
      <Flow scene={scene} medium="flue" x1={196} y1={130} x2={196} y2={80} />
      <Flow scene={scene} medium="flue" x1={196} y1={22} x2={196} y2={2} />
      <Label x={202} y={100}>
        Abgasleitung mit Mündung
      </Label>
      <Label x={202} y={112}>
        (gehört zum Gerät)
      </Label>
    </>
  )
}

/** B3: konzentrisches Rohr mit Luftöffnungen an gemeinsame Naturzug-Abgasanlage */
const b3: Layout = (scene) => {
  const floor = (y: number) => {
    const pipeY = y - 14
    return (
      <g key={y}>
        <Concentric d={`M 162 ${y} V ${pipeY} H 300`} />
        {[226, 248, 270].map((x) => (
          <g key={x}>
            <rect x={x - 3} y={pipeY + 4} width={6} height={3} fill={SURFACE} />
            <Flow scene={scene} medium="air" x1={x} y1={pipeY + 26} x2={x} y2={pipeY + 10} />
          </g>
        ))}
        <Label x={248} y={pipeY + 38} anchor="middle">
          Luft aus dem Raum
        </Label>
        <Appliance scene={scene} x={130} y={y} h={62} sealed={false} airTop />
      </g>
    )
  }
  return (
    <>
      <Building floors={2} />
      <Shaft x={300} y={8} w={30} h={274} medium="flue" />
      {floor(84)}
      {floor(206)}
      <Flow scene={scene} medium="flue" x1={315} y1={150} x2={315} y2={110} />
      <Flow scene={scene} medium="flue" x1={315} y1={36} x2={315} y2={4} />
      <Label x={248} y={276} anchor="middle">
        Öffnungen im Anschlussrohr
      </Label>
      <BuildingLabel x={294} lines={['gemeinsame Abgasanlage,', 'Naturzug (Gebäude)']} />
    </>
  )
}

/** A: ohne Abgasanlage, Abgas bleibt im Raum */
const a: Layout = (scene) => (
  <>
    <Building />
    <Appliance scene={scene} x={150} y={190} sealed={false} />
    {roomAir(scene, 150, 190, 70)}
    <Flow scene={scene} medium="flue" x1={182} y1={184} x2={182} y2={140} />
    <Flow scene={scene} medium="flue" x1={190} y1={140} x2={240} y2={110} />
    <Label x={200} y={170}>
      Abgas bleibt im Raum
    </Label>
  </>
)

/** Pfeile neben einem senkrechten konzentrischen Rohr: Luft nach unten, Abgas nach oben */
const verticalFlows = (scene: Scene, x: number, from: number, to: number) => (
  <>
    <Flow scene={scene} medium="air" x1={x - 16} y1={to} x2={x - 16} y2={from} />
    <Flow scene={scene} medium="flue" x1={x + 16} y1={from} x2={x + 16} y2={to} />
  </>
)

const c1: Layout = (scene) => (
  <>
    <Building />
    <Concentric d="M 142 190 V 140 H 14" />
    <Cap x={12} y={140} dir="left" />
    <Appliance scene={scene} x={110} y={190} sealed />
    <Flow scene={scene} medium="air" x1={70} y1={158} x2={118} y2={158} />
    <Flow scene={scene} medium="flue" x1={118} y1={122} x2={70} y2={122} />
    <Label x={60} y={110}>
      waagerechte Mündung für Luft und Abgas
    </Label>
  </>
)

/**
 * Anschluss mittig oben am Gerät, der sich in getrennte Luft- und Abgasleitung teilt (T-Abzweig), wie im
 * WOLF-Abgasschema bei C53 und C83x: konzentrischer Stutzen bis top, oben geschlossen; das Abgasrohr läuft
 * geradeaus weiter (flue: Pfad ab (cx, top), beginnt senkrecht), die Luftleitung zweigt seitlich ab
 * (air: Pfad ab (cx, top + 6), beginnt waagerecht).
 */
function Splitter({ cx, y, top, air, flue }: { cx: number; y: number; top: number; air: string; flue: string }) {
  return (
    <>
      <Pipe d={`M ${cx} ${top + 6} ${air}`} medium="air" />
      <Pipe d={`M ${cx} ${top + 2} ${flue}`} medium="flue" />
      <Concentric d={`M ${cx} ${y} V ${top}`} />
      <line x1={cx - 6.5} y1={top} x2={cx + 6.5} y2={top} stroke={INK} strokeWidth={2} />
    </>
  )
}

const c2: Layout = (scene) => {
  const floor = (y: number) => (
    <g key={y}>
      <Splitter cx={162} y={y} top={y - 16} air="H 300" flue={`V ${y - 28} H 300`} />
      <Appliance scene={scene} x={130} y={y} h={62} sealed />
    </g>
  )
  return (
    <>
      <Building floors={2} />
      <Shaft x={300} y={8} w={34} h={284} />
      {floor(84)}
      {floor(206)}
      <Flow scene={scene} medium="air" x1={317} y1={286} x2={317} y2={262} />
      <Flow scene={scene} medium="flue" x1={317} y1={36} x2={317} y2={4} />
      <BuildingLabel x={294} lines={['ein Schacht für Luft und Abgas', '(Gebäude)']} />
    </>
  )
}

const c3: Layout = (scene) => (
  <>
    <Building />
    <Concentric d="M 182 190 V 16" />
    <Cap x={182} y={14} dir="up" />
    <Appliance scene={scene} x={150} y={190} sealed />
    {verticalFlows(scene, 182, 160, 90)}
    <Label x={206} y={110}>
      Mündung über Dach
    </Label>
  </>
)

/** C3 im Schacht (WOLF C33x Schachteinbau): konzentrisch in den Schacht, darin senkrecht konzentrisch über Dach */
const c3Shaft: Layout = (scene) => (
  <>
    <Building floors={2} />
    <Shaft x={286} y={20} w={48} h={262} />
    <Concentric d="M 162 206 V 190 H 310 V 16" />
    <Cap x={310} y={14} dir="up" />
    <Appliance scene={scene} x={130} y={206} h={62} sealed />
    {verticalFlows(scene, 310, 150, 90)}
    <BuildingLabel x={280} lines={['Schacht (Gebäude), nur zur', 'Leitungsführung']} />
  </>
)

/**
 * C4 und C(10): Luft-Abgas-System des Gebäudes für mehrere Geräte, gemeinsame Mündung. Gezeichnet als
 * konzentrischer LAS (Abgasschacht innen, Luft im Ringspalt) wie im WOLF-Abgasschema (C43x).
 */
const commonAirFlue = (pressure: string): Layout => (scene) => {
  const floor = (y: number) => (
    <g key={y}>
      {/* Außenrohr (Luft) endet an der Schachtwand und öffnet in den Ringspalt; nur das Abgasrohr führt in den Abgasschacht */}
      <Pipe d={`M 270 ${y - 14} H 296`} medium="flue" />
      <Concentric d={`M 162 ${y} V ${y - 14} H 272`} />
      <Appliance scene={scene} x={130} y={y} h={62} sealed />
    </g>
  )
  return (
    <>
      <Building floors={2} />
      <Shaft x={272} y={20} w={62} h={262} medium="air" />
      <Shaft x={294} y={10} w={18} h={272} medium="flue" />
      <path d="M 268 18 L 303 2 L 338 18" fill="none" stroke={BUILDING_LINE} strokeWidth={3} />
      {floor(84)}
      {floor(206)}
      <Flow scene={scene} medium="air" x1={283} y1={100} x2={283} y2={150} />
      <Flow scene={scene} medium="air" x1={323} y1={100} x2={323} y2={150} />
      <Flow scene={scene} medium="flue" x1={303} y1={150} x2={303} y2={100} />
      <BuildingLabel x={262} lines={['Luft-Abgas-System (Gebäude):', 'Luft außen, Abgas innen,', `Abgasschacht: ${pressure}`]} />
    </>
  )
}

/**
 * C5 als Außenkamin an der Fassade (WOLF C53x): konzentrisch durch die Außenwand zur Wandkonsole, dort saugt das
 * Gerät die Luft von unten an; die Abgasleitung läuft außen an der Fassade bis über Dach
 */
const c5: Layout = (scene) => (
  <>
    <Building outsideLabel={false} />
    {/* Wandschellen der Fassadenleitung */}
    {[70, 110].map((y) => (
      <line key={y} x1={27} y1={y} x2={40} y2={y} stroke={INK} strokeWidth={2} />
    ))}
    <Pipe d="M 24 142 V 12" medium="flue" />
    <Cap x={24} y={10} dir="up" />
    {/*
      Wandkonsole wie im WOLF-Abgasschema: dreieckiges Gehäuse unter dem Bogen an der Außenwand, die schräge
      Unterseite ist offen (gestrichelt); dort strömt die Luft in den Ringspalt
    */}
    <path d="M 40 158 H 14 L 40 186 Z" fill={TINT.air} stroke="none" />
    <path d="M 40 186 V 158 H 14" fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <path d="M 14 158 L 40 186" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="3 2.5" />
    <Concentric d="M 182 190 V 152 H 36 A 12 12 0 0 1 24 140" />
    <Appliance scene={scene} x={150} y={190} sealed />
    <Flow scene={scene} medium="air" x1={4} y1={200} x2={20} y2={176} />
    <Flow scene={scene} medium="air" x1={70} y1={168} x2={130} y2={168} />
    <Flow scene={scene} medium="flue" x1={130} y1={136} x2={70} y2={136} />
    <Flow scene={scene} medium="flue" x1={10} y1={120} x2={10} y2={70} />
    <Label x={60} y={96}>
      Abgasleitung außen an der Fassade,
    </Label>
    <Label x={60} y={108}>
      Mündung über Dach
    </Label>
    <Label x={58} y={232}>
      Luft von unten
    </Label>
    <Label x={58} y={244}>
      über Wandkonsole
    </Label>
  </>
)

const c6: Layout = (scene) => (
  <>
    <Building />
    <rect x={110} y={60} width={200} height={70} rx={6} fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="6 4" />
    <Pipe d="M 182 176 V 130" dashed />
    <Concentric d="M 182 190 V 176" />
    <Appliance scene={scene} x={150} y={190} sealed />
    <Flow scene={scene} medium="air" x1={166} y1={140} x2={166} y2={176} />
    <Flow scene={scene} medium="flue" x1={198} y1={176} x2={198} y2={140} />
    <Label x={210} y={84} anchor="middle">
      Luft-Abgas-System separat
    </Label>
    <Label x={210} y={98} anchor="middle">
      zugelassen; Anordnung nach
    </Label>
    <Label x={210} y={112} anchor="middle">
      Hersteller wie andere C-Art
    </Label>
  </>
)

const c7: Layout = (scene) => (
  <>
    <Building loft />
    <Pipe d="M 175 190 V 82" medium="air" />
    <Pipe d="M 190 190 V 16" medium="flue" />
    <Cap x={190} y={14} dir="up" />
    <Diverter scene={scene} x={190} y={76} />
    <Appliance scene={scene} x={150} y={190} sealed />
    <Flow scene={scene} medium="air" x1={14} y1={80} x2={60} y2={80} />
    <Flow scene={scene} medium="air" x1={175} y1={58} x2={175} y2={76} />
    <Flow scene={scene} medium="flue" x1={204} y1={36} x2={204} y2={4} />
    <Label x={66} y={74}>
      Dachboden
    </Label>
    <Label x={210} y={62}>
      Strömungssicherung
    </Label>
    <Label x={210} y={74}>
      über der Luftöffnung
    </Label>
  </>
)

const c8: Layout = (scene) => (
  <>
    <Building />
    <Shaft x={300} y={8} w={30} h={274} medium="flue" />
    <Pipe d="M 280 244 H 300" building medium="flue" />
    <Cap x={12} y={176} dir="left" />
    <Splitter cx={182} y={190} top={170} air="H 14" flue="V 110 H 300" />
    <Appliance scene={scene} x={150} y={190} sealed />
    <Flow scene={scene} medium="air" x1={70} y1={186} x2={130} y2={186} />
    <Flow scene={scene} medium="flue" x1={200} y1={98} x2={280} y2={98} />
    <Flow scene={scene} medium="flue" x1={315} y1={60} x2={315} y2={4} />
    <Label x={296} y={234} anchor="end">
      weitere Geräte
    </Label>
    <BuildingLabel x={294} lines={['eigene oder gemeinsame', 'Abgasanlage, Naturzug (Gebäude)']} />
  </>
)

/** Vorhandener Schacht mit Abgasleitung darin, Luft strömt im Schacht nach unten */
const existingShaft = (scene: Scene, lines: string[]) => (
  <>
    <Shaft x={290} y={20} w={44} h={262} medium="air" />
    <Flow scene={scene} medium="air" x1={298} y1={4} x2={298} y2={34} />
    <Flow scene={scene} medium="air" x1={298} y1={70} x2={298} y2={120} />
    <BuildingLabel x={284} lines={lines} />
  </>
)

const c9: Layout = (scene) => (
  <>
    <Building />
    {existingShaft(scene, ['vorhandener Schacht als', 'Luftweg (Gebäude)'])}
    <Concentric d="M 162 190 V 150 H 296" />
    <Pipe d="M 296 150 H 314 V 10" medium="flue" />
    <Cap x={314} y={8} dir="up" />
    <Appliance scene={scene} x={130} y={190} sealed />
    <Flow scene={scene} medium="air" x1={260} y1={166} x2={200} y2={166} />
    <Flow scene={scene} medium="flue" x1={200} y1={134} x2={260} y2={134} />
  </>
)

/** Modulgerät: mehrere gleiche Module nebeneinander, zusammen ein Gerät */
const modules = (scene: Scene, y: number, h = 62, captionRight = false) => (
  <>
    {[0, 1, 2].map((i) => (
      <Appliance key={i} scene={scene} x={120 + 44 * i} y={y} w={44} h={h} sealed label="" />
    ))}
    {captionRight ? (
      <>
        <Label x={258} y={y + 22}>
          Modulgerät
        </Label>
        <Label x={258} y={y + 34}>
          (ein Gerät)
        </Label>
      </>
    ) : (
      <Label x={186} y={y + h + 12} anchor="middle">
        Modulgerät (ein Gerät)
      </Label>
    )}
  </>
)

const c11: Layout = (scene) => (
  <>
    <Building />
    <Concentric d="M 142 200 V 170 H 230 V 16" />
    <Concentric d="M 186 200 V 170" />
    <Cap x={230} y={14} dir="up" />
    {modules(scene, 200)}
    {verticalFlows(scene, 230, 150, 90)}
    <Label x={254} y={74}>
      ein Luft- und ein
    </Label>
    <Label x={254} y={86}>
      Abgasanschluss
    </Label>
  </>
)

const c12: Layout = (scene) => {
  const floor = (y: number) => (
    <g key={y}>
      <Cap x={12} y={y - 10} dir="left" />
      <Splitter cx={162} y={y} top={y - 16} air="H 14" flue={`V ${y - 28} H 300`} />
      <Appliance scene={scene} x={130} y={y} h={62} sealed />
    </g>
  )
  return (
    <>
      <Building floors={2} />
      <Shaft x={300} y={8} w={30} h={274} medium="flue" />
      {floor(84)}
      {floor(206)}
      <Flow scene={scene} medium="air" x1={64} y1={206} x2={110} y2={206} />
      <Flow scene={scene} medium="flue" x1={315} y1={150} x2={315} y2={110} />
      <Flow scene={scene} medium="flue" x1={315} y1={36} x2={315} y2={4} />
      <BuildingLabel x={294} lines={['gemeinsame Abgasleitung (Gebäude),', 'Überdruck möglich']} />
    </>
  )
}

const c13: Layout = (scene) => (
  <>
    <Building />
    <Pipe d="M 142 110 H 230" medium="flue" />
    <Cap x={230} y={14} dir="up" />
    {[0, 1, 2].map((i) => {
      const cx = 142 + 44 * i
      return (
        <g key={i}>
          <Cap x={12} y={150 - 12 * i} dir="left" />
          <Splitter cx={cx} y={180} top={164} air={`H ${cx - 16} V ${150 - 12 * i} H 14`} flue={i === 2 ? 'V 16' : 'V 110'} />
        </g>
      )
    })}
    {modules(scene, 180, 56, true)}
    <Flow scene={scene} medium="air" x1={58} y1={162} x2={100} y2={162} />
    <Flow scene={scene} medium="flue" x1={244} y1={100} x2={244} y2={60} />
    <Label x={226} y={102} anchor="end">
      gemeinsame Abgasleitung
    </Label>
    <Label x={56} y={116}>
      Luft je Modul
    </Label>
  </>
)

const c14: Layout = (scene) => (
  <>
    <Building />
    {existingShaft(scene, ['vorhandener gemeinsamer', 'Luftschacht (Gebäude)'])}
    <Concentric d="M 142 200 V 170 H 296" />
    <Concentric d="M 186 200 V 170" />
    <Concentric d="M 230 200 V 170" />
    <Pipe d="M 296 170 H 314 V 10" medium="flue" />
    <Cap x={314} y={8} dir="up" />
    {modules(scene, 200)}
  </>
)

const c15: Layout = (scene) => {
  const floor = (y: number, flueX: number) => (
    <g key={y}>
      <Concentric d={`M 162 ${y} V ${y - 16} H 280`} />
      <Pipe d={`M 280 ${y - 16} H ${flueX} V 10`} medium="flue" />
      <Cap x={flueX} y={8} dir="up" />
      <Appliance scene={scene} x={130} y={y} h={62} sealed />
    </g>
  )
  return (
    <>
      <Building floors={2} />
      <Shaft x={280} y={20} w={54} h={262} medium="air" />
      {floor(200, 320)}
      {floor(78, 296)}
      <Flow scene={scene} medium="air" x1={308} y1={90} x2={308} y2={140} />
      <Flow scene={scene} medium="air" x1={308} y1={4} x2={308} y2={30} />
      <BuildingLabel x={274} lines={['vorhandener gemeinsamer', 'Luftschacht (Gebäude)']} />
    </>
  )
}

/** Zeichnung je Grundart; jede Grundart des Inhalts braucht hier einen Eintrag (Test) */
/** Ausführungsvariante einer Grundart; label nur, wenn es mehrere gibt */
interface FlueVariant {
  label: string
  layout: Layout
}

const one = (layout: Layout): FlueVariant[] => [{ label: '', layout }]

/** Zeichnungen je Grundart, ggf. mehrere Ausführungen zum Umschalten (wie im WOLF-Abgasschema) */
export const FLUE_LAYOUTS: Record<string, FlueVariant[]> = {
  A: one(a),
  B1: one(bSeparate(true)),
  B2: one(bSeparate(false)),
  B3: one(b3),
  B4: one(bOwn(true)),
  B5: one(bOwn(false)),
  C1: one(c1),
  C2: one(c2),
  C3: [
    { label: 'Über Dach', layout: c3 },
    { label: 'Im Schacht', layout: c3Shaft },
  ],
  C4: one(commonAirFlue('Naturzug (Unterdruck)')),
  C5: one(c5),
  C6: one(c6),
  C7: one(c7),
  C8: one(c8),
  C9: one(c9),
  'C(10)': one(commonAirFlue('Überdruck möglich')),
  'C(11)': one(c11),
  'C(12)': one(c12),
  'C(13)': one(c13),
  'C(14)': one(c14),
  'C(15)': one(c15),
}

/** Ein Eintrag der Legende: kleines Symbol und kurzer Text */
function LegendItem({ symbol, children, wide = false }: { symbol: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${wide ? 'min-[420px]:col-span-2' : ''}`}>
      <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true" className="shrink-0">
        {symbol}
      </svg>
      <span>{children}</span>
    </li>
  )
}

const pipeSymbol = (outline: string, fill: string, width = 7, inner = 4) => (
  <>
    <line x1="2" y1="8" x2="28" y2="8" stroke={outline} strokeWidth={width} />
    <line x1="2" y1="8" x2="28" y2="8" stroke={fill} strokeWidth={inner} />
  </>
)

/** Anordnungen ohne konzentrisches Rohr (Legende „Konzentrisch“ entfällt) */
const WITHOUT_CONCENTRIC = new Set(['A', 'B1', 'B2', 'B4', 'B5', 'C7'])

/** Anordnungen mit zwei Geschossen (je Geschoss ein Gerät) */
const TWO_FLOORS = new Set(['B3', 'C2', 'C4', 'C(10)', 'C(12)', 'C(15)'])

/** Gitter in der Außenwand: Zuluft- bzw. Lüftungsöffnung ins Freie, je Geschoss mit Gerät */
function VentOpening({ scene, y, label }: { scene: Scene; y: number; label: string }) {
  return (
    <g aria-label={label}>
      <rect x={40} y={y} width={12} height={16} fill={SURFACE} stroke={INK} strokeWidth={1.5} />
      {[4, 8, 12].map((dy) => (
        <line key={dy} x1={42} y1={y + dy} x2={50} y2={y + dy} stroke={INK} strokeWidth={1} />
      ))}
      <Flow scene={scene} medium="air" x1={6} y1={y + 8} x2={36} y2={y + 8} />
      <Label x={58} y={y + 12}>
        {label}
      </Label>
    </g>
  )
}

/** Öffnung ins Freie im Aufstellraum: Bezeichnung und Erklärung kommen aus dem Inhalt (Einbaukriterien) */
export interface FlueVent {
  /** Kurzbeschriftung am Gitter, z. B. „Zuluft“ */
  label: string
  /** Kurze Erklärung in der Legende, z. B. „ins Freie, alternativ Verbrennungsluftverbund“ */
  caption: string
}

/** Schemazeichnung einer Art mit Legende */
export function FlueDiagram({
  code,
  digit,
  title,
  vent,
  initialVariant = 0,
}: {
  code: string
  digit: string | undefined
  title: string
  vent?: FlueVent
  /** Vorauswahl der Ausführung (Tests) */
  initialVariant?: number
}) {
  const [variantIndex, setVariantIndex] = useState(initialVariant)
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const variants = FLUE_LAYOUTS[code]
  if (!variants) return null
  const current = Math.min(variantIndex, variants.length - 1)
  const layout = variants[current]!.layout
  const scene: Scene = { digit, marker: (medium) => `${id}-${medium}` }
  const ventRows = TWO_FLOORS.has(code) ? [122, 244] : [244]
  return (
    <figure className="mt-4">
      {variants.length > 1 && (
        <div role="group" aria-label="Ausführung" className="mx-auto mb-2 flex max-w-md gap-2">
          {variants.map((variant, index) => (
            <button
              key={variant.label}
              type="button"
              aria-pressed={index === current}
              onClick={() => setVariantIndex(index)}
              className={`min-h-11 flex-1 rounded-lg border-2 px-2 text-sm font-semibold ${
                index === current ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
              }`}
            >
              {variant.label}
            </button>
          ))}
        </div>
      )}
      <svg viewBox="0 0 360 300" role="img" aria-label={`Schema ${title}`} className="mx-auto w-full max-w-md rounded-xl border border-edge bg-surface">
        <defs>
          {(['air', 'flue'] as const).map((medium) => (
            <marker key={medium} id={scene.marker(medium)} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 Z" fill={medium === 'air' ? AIR : FLUE} />
            </marker>
          ))}
        </defs>
        {layout(scene)}
        {vent && ventRows.map((y) => <VentOpening key={y} scene={scene} y={y} label={vent.label} />)}
      </svg>
      <figcaption className="mx-auto mt-2 max-w-md text-sm">
        <ul className="grid gap-x-4 gap-y-1.5 min-[420px]:grid-cols-2">
          <LegendItem symbol={pipeSymbol(INK, PIPE_TINT.air)}>Luft</LegendItem>
          <LegendItem symbol={pipeSymbol(INK, PIPE_TINT.flue)}>Abgas</LegendItem>
          {!WITHOUT_CONCENTRIC.has(code) && (
            <LegendItem
              symbol={
                <>
                  {pipeSymbol(INK, PIPE_TINT.air, 13, 9)}
                  {pipeSymbol(INK, PIPE_TINT.flue, 5, 2.5)}
                </>
              }
            >
              Konzentrisch: Luft außen, Abgas innen
            </LegendItem>
          )}
          <LegendItem symbol={pipeSymbol(INK, SURFACE)}>Kräftige Kontur: gehört zum Gerät</LegendItem>
          <LegendItem symbol={<rect x="2" y="2" width="26" height="12" fill={BUILDING} stroke={BUILDING_LINE} strokeWidth={1.5} />}>
            Grau: Teil des Gebäudes
          </LegendItem>
          {code.startsWith('C') && (
            <LegendItem
              symbol={
                <>
                  <rect x="6" y="1" width="18" height="14" rx="2" fill="none" stroke={INK} strokeWidth={1.5} />
                  <rect x="8.5" y="3.5" width="13" height="9" rx="1" fill="none" stroke={INK} strokeWidth={1} />
                </>
              }
            >
              Doppelter Rahmen: raumluftunabhängig
            </LegendItem>
          )}
          {vent && (
            <LegendItem
              wide
              symbol={
                <>
                  <rect x="9" y="1" width="12" height="14" fill={SURFACE} stroke={INK} strokeWidth={1.5} />
                  {[5, 8, 11].map((y) => (
                    <line key={y} x1="11" y1={y} x2="19" y2={y} stroke={INK} strokeWidth={1} />
                  ))}
                </>
              }
            >
              {vent.label}: {vent.caption}
            </LegendItem>
          )}
        </ul>
        <p className="mt-2 text-xs text-muted">Schema, nicht maßstäblich · Ausführung nach Hersteller und TRGI</p>
      </figcaption>
    </figure>
  )
}

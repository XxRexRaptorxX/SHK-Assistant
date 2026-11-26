import { useId, type ReactNode } from 'react'

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

// ---------- Bausteine ----------

/** Rohr: dunkel = gehört zum Gerät, grau = Gebäude oder separat zugelassen */
function Pipe({ d, building = false, dashed = false }: { d: string; building?: boolean; dashed?: boolean }) {
  const dash = dashed ? '6 4' : undefined
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke={building ? BUILDING_LINE : INK} strokeWidth={7} strokeDasharray={dash} />
      <path d={d} stroke={building ? BUILDING : SURFACE} strokeWidth={3} strokeDasharray={dash} />
    </g>
  )
}

/** Konzentrisches Luft-Abgas-Rohr: außen Luft, innen Abgas */
function Concentric({ d }: { d: string }) {
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={d} stroke={INK} strokeWidth={13} />
      <path d={d} stroke={SURFACE} strokeWidth={9} />
      <path d={d} stroke={INK} strokeWidth={3} />
    </g>
  )
}

/** Schacht oder Abgasanlage des Gebäudes */
const Shaft = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
  <rect x={x} y={y} width={w} height={h} fill={BUILDING} stroke={BUILDING_LINE} strokeWidth={1.5} />
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
          <Pipe d={`M ${cx} ${y - 24} V ${y - 44}`} />
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
function Appliance({ scene, x, y, w = 64, h = 70, sealed, label = 'Gerät' }: { scene: Scene; x: number; y: number; w?: number; h?: number; sealed: boolean; label?: string }) {
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
      {scene.digit === '3' && <Fan x={x + 11} y={y + h - 13} />}
      {label && (
        <text x={x - 4} y={y + 10} fontSize={8.5} fill={LABEL} textAnchor="end">
          {label}
        </text>
      )}
    </g>
  )
}

/** Gebäudeschnitt: außen links, Außenwand, Dach oben, Boden unten; optional Zwischendecke oder Dachboden */
function Building({ floors = 1, loft = false }: { floors?: 1 | 2; loft?: boolean }) {
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
      <Label x={4} y={34}>
        außen
      </Label>
    </g>
  )
}

// ---------- Anordnungen je Grundart ----------

type Layout = (scene: Scene) => ReactNode

/** Raumluftabhängig: Luft strömt aus dem Raum unten ins Gerät */
const roomAir = (scene: Scene, x: number, y: number, h: number) => (
  <>
    <Flow scene={scene} medium="air" x1={x - 44} y1={y + h - 8} x2={x - 4} y2={y + h - 8} />
    <Label x={x - 46} y={y + h + 10}>
      Luft aus dem Raum
    </Label>
  </>
)

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
      <Shaft x={300} y={8} w={30} h={274} />
      <Pipe d={`M 182 ${top} V 110 H 300`} building />
      <FlueStack scene={scene} cx={182} y={190} diverter={diverter} />
      <Appliance scene={scene} x={150} y={190} sealed={false} />
      {roomAir(scene, 150, 190, 70)}
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
      <Pipe d={`M 182 ${top} V 16`} />
      <Cap x={182} y={14} dir="up" />
      <FlueStack scene={scene} cx={182} y={190} diverter={diverter} />
      <Appliance scene={scene} x={150} y={190} sealed={false} />
      {roomAir(scene, 150, 190, 70)}
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
    const pipeY = y + 18
    return (
      <g key={y}>
        <Concentric d={`M 194 ${pipeY} H 300`} />
        {[226, 248, 270].map((x) => (
          <g key={x}>
            <rect x={x - 3} y={pipeY - 7} width={6} height={3} fill={SURFACE} />
            <Flow scene={scene} medium="air" x1={x} y1={pipeY - 26} x2={x} y2={pipeY - 10} />
          </g>
        ))}
        <Label x={248} y={pipeY - 30} anchor="middle">
          Luft aus dem Raum
        </Label>
        <Appliance scene={scene} x={130} y={y} h={62} sealed={false} />
      </g>
    )
  }
  return (
    <>
      <Building floors={2} />
      <Shaft x={300} y={8} w={30} h={274} />
      {floor(78)}
      {floor(200)}
      <Flow scene={scene} medium="flue" x1={315} y1={150} x2={315} y2={110} />
      <Flow scene={scene} medium="flue" x1={315} y1={36} x2={315} y2={4} />
      <Label x={248} y={274} anchor="middle">
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

const c2: Layout = (scene) => {
  const floor = (y: number) => (
    <g key={y}>
      <Pipe d={`M 194 ${y + 50} H 300`} />
      <Pipe d={`M 162 ${y} V ${y - 14} H 300`} />
      <Appliance scene={scene} x={130} y={y} h={62} sealed />
    </g>
  )
  return (
    <>
      <Building floors={2} />
      <Shaft x={300} y={8} w={34} h={284} />
      {floor(78)}
      {floor(200)}
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

/** C4 und C(10): Luftschacht und Abgasschacht des Gebäudes für mehrere Geräte, gemeinsame Mündung */
const commonAirFlue = (pressure: string): Layout => (scene) => {
  const floor = (y: number) => (
    <g key={y}>
      <Pipe d={`M 194 ${y + 50} H 270`} />
      <Pipe d={`M 162 ${y} V ${y - 14} H 302`} />
      <Appliance scene={scene} x={130} y={y} h={62} sealed />
    </g>
  )
  return (
    <>
      <Building floors={2} />
      <Shaft x={270} y={20} w={30} h={262} />
      <Shaft x={302} y={20} w={30} h={262} />
      <path d="M 266 18 L 301 6 L 336 18" fill="none" stroke={BUILDING_LINE} strokeWidth={3} />
      {floor(78)}
      {floor(200)}
      <Flow scene={scene} medium="air" x1={285} y1={100} x2={285} y2={140} />
      <Flow scene={scene} medium="flue" x1={317} y1={140} x2={317} y2={100} />
      <BuildingLabel x={260} lines={['Luftschacht + Abgasschacht (Gebäude)', `Abgasschacht: ${pressure}`]} />
    </>
  )
}

const c5: Layout = (scene) => (
  <>
    <Building />
    <Pipe d="M 150 250 H 14" />
    <Cap x={12} y={250} dir="left" />
    <Pipe d="M 182 190 V 16" />
    <Cap x={182} y={14} dir="up" />
    <Appliance scene={scene} x={150} y={190} sealed />
    <Flow scene={scene} medium="air" x1={70} y1={238} x2={130} y2={238} />
    <Flow scene={scene} medium="flue" x1={196} y1={140} x2={196} y2={90} />
    <Label x={60} y={272}>
      Luftmündung
    </Label>
    <Label x={206} y={110}>
      getrennte Mündungen,
    </Label>
    <Label x={206} y={122}>
      versch. Druckbereiche
    </Label>
  </>
)

const c6: Layout = (scene) => (
  <>
    <Building />
    <rect x={110} y={60} width={200} height={70} rx={6} fill="none" stroke={INK} strokeWidth={1.5} strokeDasharray="6 4" />
    <Pipe d="M 172 190 V 130" dashed />
    <Pipe d="M 192 190 V 130" dashed />
    <Appliance scene={scene} x={150} y={190} sealed />
    <Flow scene={scene} medium="air" x1={160} y1={140} x2={160} y2={180} />
    <Flow scene={scene} medium="flue" x1={204} y1={180} x2={204} y2={140} />
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
    <Pipe d="M 170 190 V 82" />
    <Pipe d="M 196 190 V 16" />
    <Cap x={196} y={14} dir="up" />
    <Diverter scene={scene} x={196} y={76} />
    <Appliance scene={scene} x={150} y={190} sealed />
    <Flow scene={scene} medium="air" x1={14} y1={80} x2={60} y2={80} />
    <Flow scene={scene} medium="air" x1={170} y1={58} x2={170} y2={76} />
    <Flow scene={scene} medium="flue" x1={210} y1={36} x2={210} y2={4} />
    <Label x={66} y={74}>
      Dachboden
    </Label>
    <Label x={216} y={62}>
      Strömungssicherung
    </Label>
    <Label x={216} y={74}>
      über der Luftöffnung
    </Label>
  </>
)

const c8: Layout = (scene) => (
  <>
    <Building />
    <Shaft x={300} y={8} w={30} h={274} />
    <Pipe d="M 280 150 H 300" building />
    <Pipe d="M 150 250 H 14" />
    <Cap x={12} y={250} dir="left" />
    <Pipe d="M 182 190 V 110 H 300" />
    <Appliance scene={scene} x={150} y={190} sealed />
    <Flow scene={scene} medium="air" x1={70} y1={238} x2={130} y2={238} />
    <Flow scene={scene} medium="flue" x1={200} y1={98} x2={280} y2={98} />
    <Flow scene={scene} medium="flue" x1={315} y1={60} x2={315} y2={4} />
    <Label x={276} y={154} anchor="end">
      ggf. weitere Geräte
    </Label>
    <BuildingLabel x={294} lines={['eigene oder gemeinsame', 'Abgasanlage, Naturzug (Gebäude)']} />
  </>
)

/** Vorhandener Schacht mit Abgasleitung darin, Luft strömt im Schacht nach unten */
const existingShaft = (scene: Scene, lines: string[]) => (
  <>
    <Shaft x={290} y={20} w={44} h={262} />
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
    <Pipe d="M 296 150 H 314 V 10" />
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
      <Pipe d={`M 130 ${y + 50} H 14`} />
      <Cap x={12} y={y + 50} dir="left" />
      <Pipe d={`M 162 ${y} V ${y - 14} H 300`} />
      <Appliance scene={scene} x={130} y={y} h={62} sealed />
    </g>
  )
  return (
    <>
      <Building floors={2} />
      <Shaft x={300} y={8} w={30} h={274} />
      {floor(78)}
      {floor(200)}
      <Flow scene={scene} medium="air" x1={64} y1={238} x2={110} y2={238} />
      <Flow scene={scene} medium="flue" x1={315} y1={150} x2={315} y2={110} />
      <Flow scene={scene} medium="flue" x1={315} y1={36} x2={315} y2={4} />
      <BuildingLabel x={294} lines={['gemeinsame Abgasleitung (Gebäude),', 'Überdruck möglich']} />
    </>
  )
}

const c13: Layout = (scene) => (
  <>
    <Building />
    <Pipe d="M 150 180 V 150 H 238 V 16" />
    <Pipe d="M 194 180 V 150" />
    <Cap x={238} y={14} dir="up" />
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <Pipe d={`M ${130 + 44 * i} 236 V ${250 + 10 * i} H 14`} />
        <Cap x={12} y={250 + 10 * i} dir="left" />
      </g>
    ))}
    {modules(scene, 180, 56, true)}
    <Flow scene={scene} medium="air" x1={58} y1={238} x2={100} y2={238} />
    <Flow scene={scene} medium="flue" x1={252} y1={130} x2={252} y2={80} />
    <Label x={232} y={140} anchor="end">
      gemeinsame Abgasleitung
    </Label>
    <Label x={56} y={226}>
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
    <Pipe d="M 296 170 H 314 V 10" />
    <Cap x={314} y={8} dir="up" />
    {modules(scene, 200)}
  </>
)

const c15: Layout = (scene) => {
  const floor = (y: number, flueX: number) => (
    <g key={y}>
      <Concentric d={`M 162 ${y} V ${y - 16} H 280`} />
      <Pipe d={`M 280 ${y - 16} H ${flueX} V 10`} />
      <Cap x={flueX} y={8} dir="up" />
      <Appliance scene={scene} x={130} y={y} h={62} sealed />
    </g>
  )
  return (
    <>
      <Building floors={2} />
      <Shaft x={280} y={20} w={54} h={262} />
      {floor(200, 320)}
      {floor(78, 296)}
      <Flow scene={scene} medium="air" x1={308} y1={90} x2={308} y2={140} />
      <Flow scene={scene} medium="air" x1={308} y1={4} x2={308} y2={30} />
      <BuildingLabel x={274} lines={['vorhandener gemeinsamer', 'Luftschacht (Gebäude)']} />
    </>
  )
}

/** Zeichnung je Grundart; jede Grundart des Inhalts braucht hier einen Eintrag (Test) */
export const FLUE_LAYOUTS: Record<string, Layout> = {
  A: a,
  B1: bSeparate(true),
  B2: bSeparate(false),
  B3: b3,
  B4: bOwn(true),
  B5: bOwn(false),
  C1: c1,
  C2: c2,
  C3: c3,
  C4: commonAirFlue('Naturzug (Unterdruck)'),
  C5: c5,
  C6: c6,
  C7: c7,
  C8: c8,
  C9: c9,
  'C(10)': commonAirFlue('Überdruck möglich'),
  'C(11)': c11,
  'C(12)': c12,
  'C(13)': c13,
  'C(14)': c14,
  'C(15)': c15,
}

function LegendLine({ color, children, wide = false, building = false }: { color?: string; children: ReactNode; wide?: boolean; building?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <svg width="28" height="12" aria-hidden="true">
        {color ? (
          <line x1="2" y1="6" x2="22" y2="6" stroke={color} strokeWidth="2.5" />
        ) : (
          <>
            <line x1="2" y1="6" x2="26" y2="6" stroke={building ? BUILDING_LINE : INK} strokeWidth={wide ? 10 : 7} />
            <line x1="2" y1="6" x2="26" y2="6" stroke={building ? BUILDING : SURFACE} strokeWidth={wide ? 8 : 3} />
          </>
        )}
        {color && <path d="M 20 2 L 27 6 L 20 10 Z" fill={color} />}
      </svg>
      <span>{children}</span>
    </li>
  )
}

/** Schemazeichnung einer Art mit Legende */
export function FlueDiagram({ code, digit, title }: { code: string; digit: string | undefined; title: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const layout = FLUE_LAYOUTS[code]
  if (!layout) return null
  const scene: Scene = { digit, marker: (medium) => `${id}-${medium}` }
  return (
    <figure className="mt-4">
      <svg viewBox="0 0 360 300" role="img" aria-label={`Schema ${title}`} className="mx-auto w-full max-w-md rounded-xl border border-edge bg-surface">
        <defs>
          {(['air', 'flue'] as const).map((medium) => (
            <marker key={medium} id={scene.marker(medium)} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 Z" fill={medium === 'air' ? AIR : FLUE} />
            </marker>
          ))}
        </defs>
        {layout(scene)}
      </svg>
      <figcaption className="mt-2 text-sm">
        <ul className="grid gap-1 min-[420px]:grid-cols-2">
          <LegendLine color={AIR}>Verbrennungsluft</LegendLine>
          <LegendLine color={FLUE}>Abgas</LegendLine>
          <LegendLine>Leitung gehört zum Gerät</LegendLine>
          <LegendLine building wide>
            Gebäude bzw. separat zugelassen
          </LegendLine>
        </ul>
        <p className="mt-1 text-muted">
          Doppelter Rahmen = raumluftunabhängig (geschlossen). Schema, nicht maßstäblich; ein Beispiel der Anordnung nach
          der Definition in DIN EN 1749. Ausführung nach Hersteller und TRGI.
        </p>
      </figcaption>
    </figure>
  )
}

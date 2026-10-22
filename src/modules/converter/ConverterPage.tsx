import { useParams } from 'react-router'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { RichText } from '../../components/RichText'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { HideButton } from '../../hidden/HideButton'
import { usePageTitle } from '../../lib/usePageTitle'
import { ensureCustomUnits } from '../units/customUnits'
import { converterEntries, converterTitle, findConverter } from './converter'
import { ConverterTitle } from './converterUi'
import { FactorConverter } from './FactorConverter'
import { FractionsConverter } from './FractionsConverter'
import { NumeralConverter } from './NumeralConverter'
import { RatioConverter } from './RatioConverter'
import type { ConverterEntry } from './schema'
import { SlopeConverter } from './SlopeConverter'
import { TableView } from './TableView'
import { UnitConverter } from './UnitConverter'

// Wird per React.lazy geladen, damit mathjs nicht im Start-Bundle landet.
ensureCustomUnits()

const BACK = { to: '/umrechner', label: 'Umrechner' }

function ConverterBody({ entry }: { entry: ConverterEntry }) {
  switch (entry.kind) {
    case 'units':
      return <UnitConverter entry={entry} />
    case 'factors':
      return <FactorConverter entry={entry} />
    case 'slope':
      return <SlopeConverter />
    case 'ratio':
      return <RatioConverter rare={entry.rare} />
    case 'fractions':
      return <FractionsConverter rare={entry.rare} />
    case 'numeral':
      return <NumeralConverter rare={entry.rare} />
    case 'table':
      return <TableView entry={entry} />
  }
}

export default function ConverterPage({ entries = converterEntries }: { entries?: ConverterEntry[] }) {
  const { slug } = useParams()
  const entry = findConverter(entries, slug)
  if (!entry) return <ConverterNotFound />
  return (
    <ContentPage
      entry={entry}
      title={converterTitle(entry)}
      heading={<ConverterTitle entry={entry} />}
      back={BACK}
      actions={
        <>
          <HideButton id={entry.id} title={`Umrechner ${entry.title}`} />
          <FavoriteButton id={entry.id} title={`Umrechner ${entry.title}`} />
        </>
      }
    >
      {/* Rechner zuerst, damit er auf dem Handy ohne Scrollen erreichbar ist */}
      <ConverterBody key={entry.id} entry={entry} />
      {entry.description && (
        <section className="mt-6">
          <h2 className="text-xl font-bold">Hinweis</h2>
          <div className="mt-2">
            <RichText text={entry.description} />
          </div>
        </section>
      )}
    </ContentPage>
  )
}

function ConverterNotFound() {
  usePageTitle('Größe nicht gefunden')
  return (
    <>
      <BackLink to={BACK.to} label={BACK.label} />
      <h1 className="text-2xl font-bold">Größe nicht gefunden</h1>
      <p className="mt-2 text-muted">Diese Größe gibt es im Umrechner nicht (mehr).</p>
    </>
  )
}

import { Link, useParams } from 'react-router'
import { modules } from '../../app/modules'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { DraftBadge } from '../../components/DraftBadge'
import { listCard } from '../../components/surfaces'
import { RichText } from '../../components/RichText'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { usePageTitle } from '../../lib/usePageTitle'
import { FormulaBody } from '../formulas/FormulaDetailPage'
import { ensureCustomUnits } from '../units/customUnits'
import { findTool, toolEntries, toolPath } from './tools'
import {
  relatedTools,
  isCableTool,
  isChoiceTool,
  isFactorTool,
  isHazmatPointsTool,
  isHeatingCostTool,
  isMaterialListTool,
  isNormFinderTool,
  isPlacementTool,
  isRadiatorSurveyTool,
  isRefrigerantTool,
  isSequenceTool,
  isSymbolTool,
  isTableTool,
  isValveSurveyTool,
  isVariantTool,
  isVentilationRiserTool,
  isWireColorTool,
  isWorkHoursTool,
  type ToolEntry,
} from './schema'
import { CableLookup } from './CableLookup'
import { FactorCalculator } from './FactorCalculator'
import { HazmatPoints } from './HazmatPoints'
import { HeatingCostComparison } from './HeatingCostComparison'
import { ChoiceLookup } from './ChoiceLookup'
import { MaterialList } from './MaterialList'
import { NormFinder } from './NormFinder'
import { PlacementLookup } from './PlacementLookup'
import { RadiatorSurvey } from './RadiatorSurvey'
import { RefrigerantLookup } from './RefrigerantLookup'
import { RiserLookup } from './RiserLookup'
import { SequenceLookup } from './SequenceLookup'
import { SymbolLookup } from './SymbolLookup'
import { TableLookup } from './TableLookup'
import { TopicTags } from '../../components/TopicTags'
import { ValveSurvey } from './ValveSurvey'
import { VariantCalculator } from './VariantCalculator'
import { WireColorLookup } from './WireColorLookup'
import { WorkHours } from './WorkHours'

const BACK = { to: modules.tools.path, label: modules.tools.title }

ensureCustomUnits()

/** Ein Tool: Skizze, Formel, Legende und Rechner wie bei den Formeln oder eine Nachschlagetabelle. Nachgeladen (mathjs). */
export default function ToolPage({ entries = toolEntries }: { entries?: ToolEntry[] }) {
  const { slug } = useParams()
  const tool = findTool(entries, slug)
  if (!tool) return <ToolNotFound />
  return (
    <ContentPage
      entry={tool}
      title={tool.title}
      back={BACK}
      actions={<FavoriteButton id={tool.id} title={tool.title} />}
      meta={<TopicTags tags={tool.tags} />}
    >
      <RichText text={tool.description} />
      {isTableTool(tool) ? (
        <TableLookup tool={tool} />
      ) : isChoiceTool(tool) ? (
        <ChoiceLookup tool={tool} />
      ) : isFactorTool(tool) ? (
        <FactorCalculator tool={tool} />
      ) : isVariantTool(tool) ? (
        <VariantCalculator tool={tool} />
      ) : isSymbolTool(tool) ? (
        <SymbolLookup tool={tool} />
      ) : isSequenceTool(tool) ? (
        <SequenceLookup tool={tool} />
      ) : isCableTool(tool) ? (
        <CableLookup tool={tool} />
      ) : isWireColorTool(tool) ? (
        <WireColorLookup tool={tool} />
      ) : isNormFinderTool(tool) ? (
        <NormFinder tool={tool} />
      ) : isRefrigerantTool(tool) ? (
        <RefrigerantLookup tool={tool} />
      ) : isPlacementTool(tool) ? (
        <PlacementLookup tool={tool} />
      ) : isWorkHoursTool(tool) ? (
        <WorkHours closingNote={tool.closingNote} />
      ) : isValveSurveyTool(tool) ? (
        <ValveSurvey tool={tool} />
      ) : isRadiatorSurveyTool(tool) ? (
        <RadiatorSurvey tool={tool} />
      ) : isVentilationRiserTool(tool) ? (
        <RiserLookup tool={tool} />
      ) : isHeatingCostTool(tool) ? (
        <HeatingCostComparison tool={tool} />
      ) : isMaterialListTool(tool) ? (
        <MaterialList tool={tool} />
      ) : isHazmatPointsTool(tool) ? (
        <HazmatPoints tool={tool} />
      ) : (
        <FormulaBody formula={tool} />
      )}
      <RelatedTools tool={tool} entries={entries} />
    </ContentPage>
  )
}

/** „Passende Tools“ am Seitenende: im Eintrag unter related genannt, nur vorhandene (im public-Build fehlen interne) */
function RelatedTools({ tool, entries }: { tool: ToolEntry; entries: readonly ToolEntry[] }) {
  const related = relatedTools(tool).flatMap((id) => entries.find((entry) => entry.id === id) ?? [])
  if (related.length === 0) return null
  return (
    <section className="mt-8 print:hidden">
      <h2 className="text-xl font-bold">Passende Tools</h2>
      <ul className={`mt-2 ${listCard}`}>
        {related.map((entry) => (
          <li key={entry.id}>
            <Link to={toolPath(entry.id)} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <span>
                <span className="block font-semibold">{entry.title}</span>
                <span className="block text-base text-muted">{entry.summary}</span>
              </span>
              {entry.status === 'draft' && <DraftBadge variant="inline" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ToolNotFound() {
  usePageTitle('Tool nicht gefunden')
  return (
    <>
      <BackLink to={BACK.to} label={BACK.label} />
      <h1 className="text-2xl font-bold">Tool nicht gefunden</h1>
    </>
  )
}

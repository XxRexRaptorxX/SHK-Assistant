import { useParams } from 'react-router'
import { modules } from '../../app/modules'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { RichText } from '../../components/RichText'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { usePageTitle } from '../../lib/usePageTitle'
import { FormulaBody } from '../formulas/FormulaDetailPage'
import { ensureCustomUnits } from '../units/customUnits'
import { findTool, toolEntries } from './tools'
import { isChoiceTool, isFactorTool, isTableTool, type ToolEntry } from './schema'
import { FactorCalculator } from './FactorCalculator'
import { ChoiceLookup } from './ChoiceLookup'
import { TableLookup } from './TableLookup'

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
    >
      <RichText text={tool.description} />
      {isTableTool(tool) ? (
        <TableLookup tool={tool} />
      ) : isChoiceTool(tool) ? (
        <ChoiceLookup tool={tool} />
      ) : isFactorTool(tool) ? (
        <FactorCalculator tool={tool} />
      ) : (
        <FormulaBody formula={tool} />
      )}
    </ContentPage>
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

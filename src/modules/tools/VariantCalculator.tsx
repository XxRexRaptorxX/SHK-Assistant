import { useState } from 'react'
import { RichText } from '../../components/RichText'
import { FormulaBody } from '../formulas/FormulaDetailPage'
import { SelectionBar } from './ChoiceLookup'
import { variantFormula, type VariantTool } from './variantTool'

/** Varianten-Tool: Leiste zum Umschalten, darunter Beschreibung, Skizze, Formel und Rechner der Variante */
export function VariantCalculator({ tool, initialVariant }: { tool: VariantTool; initialVariant?: string }) {
  const [selected, setSelected] = useState(initialVariant ?? tool.variants[0]!.key)
  const variant = tool.variants.find((candidate) => candidate.key === selected) ?? tool.variants[0]!
  const bar = {
    key: 'variante',
    name: tool.name,
    options: tool.variants.map(({ key, label, note }) => ({ key, label, note })),
  }
  return (
    <>
      <SelectionBar bar={bar} selected={variant.key} onSelect={setSelected} />
      <section className="mt-6" aria-labelledby={`variant-${variant.key}`}>
        <h2 id={`variant-${variant.key}`} className="text-xl font-bold">
          {variant.title}
        </h2>
        <div className="mt-2">
          <RichText text={variant.description} />
        </div>
        <FormulaBody formula={variantFormula(tool, variant)} />
      </section>
    </>
  )
}

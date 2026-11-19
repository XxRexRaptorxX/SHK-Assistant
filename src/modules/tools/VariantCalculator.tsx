import { useState } from 'react'
import { RichText } from '../../components/RichText'
import { FormulaBody } from '../formulas/FormulaDetailPage'
import { SelectionBar } from './ChoiceLookup'
import { variantAfterModeChange, variantFormula, variantsInMode, type VariantTool } from './variantTool'

/**
 * Varianten-Tool: optional oben die Modus-Leiste (z. B. kg/h | USgal/h), darunter die Leiste der
 * Varianten des Modus, dann Beschreibung, Skizze, Formel und Rechner der gewählten Variante
 */
export function VariantCalculator({ tool, initialVariant }: { tool: VariantTool; initialVariant?: string }) {
  const [selected, setSelected] = useState(initialVariant ?? tool.variants[0]!.key)
  const variant = tool.variants.find((candidate) => candidate.key === selected) ?? tool.variants[0]!
  const mode = variant.mode
  const bar = {
    key: 'variante',
    name: tool.name,
    options: variantsInMode(tool, mode).map(({ key, label, note }) => ({ key, label, note })),
  }
  return (
    <>
      {tool.modes && (
        <SelectionBar
          bar={{ key: 'modus', ...tool.modes }}
          selected={mode}
          onSelect={(next) => setSelected(variantAfterModeChange(tool, variant.key, next))}
        />
      )}
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

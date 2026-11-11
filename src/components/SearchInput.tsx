import type { ReactNode } from 'react'
import { fieldBase } from './surfaces'
interface SearchInputProps {
  /** Knopf rechts im Feld, z. B. Filter */
  trailing?: ReactNode
  id: string
  /** Für Screenreader, nicht sichtbar */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchInput({ id, label, value, onChange, placeholder, autoFocus, trailing }: SearchInputProps) {
  const input = (
    <input
      id={id}
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="off"
      enterKeyHint="search"
      className={`${fieldBase} w-full placeholder:text-muted ${trailing ? 'pr-14' : ''}`}
    />
  )
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {trailing ? (
        <div className="relative">
          {input}
          <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>
        </div>
      ) : (
        input
      )}
    </>
  )
}

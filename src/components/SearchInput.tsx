import { fieldBase } from './surfaces'
interface SearchInputProps {
  id: string
  /** Für Screenreader, nicht sichtbar */
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchInput({ id, label, value, onChange, placeholder, autoFocus }: SearchInputProps) {
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        className={`${fieldBase} w-full placeholder:text-muted`}
      />
    </>
  )
}

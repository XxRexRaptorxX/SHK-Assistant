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
        className="min-h-12 w-full rounded-lg border-2 border-line bg-page px-3 text-lg placeholder:text-muted"
      />
    </>
  )
}

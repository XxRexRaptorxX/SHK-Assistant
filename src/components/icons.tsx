import type { ReactNode, SVGProps } from 'react'

// Eigene, schlichte Strich-Icons (24×24), damit keine Icon-Bibliothek nötig ist.

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 11 12 3l9 8M5 9.5V21h5v-6h4v6h5V9.5" />
    </Icon>
  )
}

export function CalculatorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <rect x="7" y="5" width="10" height="4" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" strokeWidth={2.75} />
    </Icon>
  )
}

export function ConvertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h15l-4-4M20 16H5l4 4" />
    </Icon>
  )
}

export function ChecklistIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 6h10M10 12h10M10 18h10M3.5 6l1.5 1.5L8 4.5M3.5 12l1.5 1.5L8 10.5M3.5 18l1.5 1.5L8 16.5" />
    </Icon>
  )
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z" />
    </Icon>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-5-5" />
    </Icon>
  )
}

export function KeyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2.5 2.5" />
    </Icon>
  )
}

/** Tasse mit rotem Herz wie bei Ko-fi (eigene Zeichnung, Herz in der Ko-fi-Farbe) */
export function KofiIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 8h13v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path
        d="M9.5 16s-3.2-1.9-3.2-3.9c0-1.1.8-1.9 1.8-1.9.6 0 1.1.3 1.4.8.3-.5.8-.8 1.4-.8 1 0 1.8.8 1.8 1.9 0 2-3.2 3.9-3.2 3.9z"
        fill="#ff5e5b"
        stroke="none"
      />
    </Icon>
  )
}

export function NewsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 13h7M7 16h4" />
    </Icon>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3 2.8 5.9 6.2.7-4.6 4.3 1.3 6.2L12 17l-5.7 3.1 1.3-6.2L3 9.6l6.2-.7z" />
    </Icon>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

/** Durchgestrichenes Auge: ausgeblendet */
export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </Icon>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </Icon>
  )
}

/** Halb gefüllter Kreis: "wie System" */
export function SystemThemeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </Icon>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </Icon>
  )
}

export function WarningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 2 21h20zM12 10v5M12 18h.01" />
    </Icon>
  )
}

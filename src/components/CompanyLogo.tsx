// Firmenlogo aus src/assets/brand (siehe README dort). Ohne Datei wird nichts angezeigt.
const logos = import.meta.glob<string>('../assets/brand/firmenlogo.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const companyLogoUrl: string | undefined = Object.values(logos)[0]

/** Logo auf weißer Fläche, damit die Firmenfarben auch im dunklen Design gut lesbar sind */
export function CompanyLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  if (!companyLogoUrl) return null
  return (
    <span className="inline-flex rounded-2xl bg-white px-4 py-2.5 shadow-sm">
      <img src={companyLogoUrl} alt="Firmenlogo" className={className} />
    </span>
  )
}

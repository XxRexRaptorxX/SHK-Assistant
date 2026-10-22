// Firmenlogo aus src/assets/brand (siehe README dort). Ohne Datei wird nichts angezeigt.
const logos = import.meta.glob<string>('../assets/brand/firmenlogo.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const companyLogoUrl: string | undefined = Object.values(logos)[0]

export function CompanyLogo({ className = 'h-10 w-auto' }: { className?: string }) {
  if (!companyLogoUrl) return null
  return <img src={companyLogoUrl} alt="Firmenlogo" className={className} />
}

import { COMPANY_URL } from '../config/links'

// Firmenlogo aus src/assets/brand (siehe README dort). Ohne Datei wird nichts angezeigt.
const logos = import.meta.glob<string>('../assets/brand/firmenlogo.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const companyLogoUrl: string | undefined = Object.values(logos)[0]

const COMPANY_LINK_LABEL = 'Firmenlogo – Webseite von Biebl Haustechnik öffnen'

/** Firmenlogo als Link zur Firmenwebseite */
export function CompanyLogoLink({ className, imageClassName }: { className: string; imageClassName: string }) {
  if (!companyLogoUrl) return null
  return (
    <a
      href={COMPANY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={COMPANY_LINK_LABEL}
      title={COMPANY_LINK_LABEL}
      className={className}
    >
      <img src={companyLogoUrl} alt="" className={imageClassName} />
    </a>
  )
}

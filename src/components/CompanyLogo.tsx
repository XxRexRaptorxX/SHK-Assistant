// Firmenlogo aus src/assets/brand (siehe README dort). Ohne Datei wird nichts angezeigt.
const logos = import.meta.glob<string>('../assets/brand/firmenlogo.{svg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const companyLogoUrl: string | undefined = Object.values(logos)[0]

export const COMPANY_LINK_LABEL = 'Firmenlogo – Webseite von Biebl Haustechnik öffnen'

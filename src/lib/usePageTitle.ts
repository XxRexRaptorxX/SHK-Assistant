import { useEffect } from 'react'

const APP_NAME = 'SHK-Assistant'
/** Wie der Titel in index.html: Suchmaschinen lesen den Titel nach dem Rendern */
const HOME_TITLE = `${APP_NAME} – Werkzeugkasten für Heizungsbauer`

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} – ${APP_NAME}` : HOME_TITLE
  }, [title])
}

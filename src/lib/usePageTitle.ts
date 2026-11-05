import { useEffect } from 'react'
// HOME_TITLE wie in index.html: Suchmaschinen lesen den Titel nach dem Rendern
import { APP_NAME, HOME_TITLE } from '../config/seo'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} – ${APP_NAME}` : HOME_TITLE
  }, [title])
}

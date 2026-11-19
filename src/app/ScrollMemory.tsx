import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

/** Gemerkte Scrollpositionen je Seite (Pfad + Suchparameter), nur für die laufende Sitzung */
const positions = new Map<string, number>()

/** Link-State, mit dem ein Link (z. B. „← Zurück“) die gemerkte Position wiederherstellen lässt */
export const RESTORE_SCROLL_STATE = { restoreScroll: true } as const

function wantsRestore(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { restoreScroll?: unknown }).restoreScroll === true
}

/**
 * Merkt sich, wie weit auf jeder Seite gescrollt wurde.
 * Zurück (Browser/Gerät oder BackLink) → gemerkte Stelle, neue Seite → nach oben.
 */
export function ScrollMemory() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const pageKey = location.pathname + location.search
  const currentKey = useRef(pageKey)

  // Beim Seitenwechsel steht beim Rendern noch die alte Seite im DOM: ihre Position jetzt sichern
  if (currentKey.current !== pageKey) positions.set(currentKey.current, window.scrollY)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  useLayoutEffect(() => {
    currentKey.current = pageKey
    const target = navigationType === 'POP' || wantsRestore(location.state) ? (positions.get(pageKey) ?? 0) : 0
    window.scrollTo(0, target)
    if (target === 0) return
    // Nachgeladene Seiten sind evtl. noch nicht hoch genug: einige Frames nachversuchen
    let frames = 0
    let raf = 0
    let cancelled = false
    const cancel = () => {
      cancelled = true
    }
    const retry = () => {
      if (cancelled || Math.abs(window.scrollY - target) < 2 || frames++ > 60) return
      window.scrollTo(0, target)
      raf = requestAnimationFrame(retry)
    }
    raf = requestAnimationFrame(retry)
    // Scrollt der Nutzer selbst, nicht dagegen arbeiten
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchstart', cancel, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
    }
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

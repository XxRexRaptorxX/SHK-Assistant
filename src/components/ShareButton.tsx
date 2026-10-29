import { useEffect, useState } from 'react'
import { ShareIcon } from './icons'

/** Was geteilt wird: Titel und Adresse der gerade geöffneten Seite */
export function currentShareData(): { title: string; url: string } {
  return { title: document.title, url: window.location.href }
}

type Feedback = 'copied' | 'failed' | undefined

/**
 * Teilt die aktuell geöffnete Seite: über das Teilen-Menü des Geräts (Handy, viele Browser),
 * sonst wird der Link in die Zwischenablage kopiert.
 */
export function ShareButton({ className }: { className: string }) {
  const [feedback, setFeedback] = useState<Feedback>()
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(undefined), 2500)
    return () => clearTimeout(timer)
  }, [feedback])

  const share = async () => {
    const data = currentShareData()
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(data)
      } catch {
        // abgebrochen oder nicht erlaubt: nichts weiter tun
      }
      return
    }
    try {
      await navigator.clipboard.writeText(data.url)
      setFeedback('copied')
    } catch {
      setFeedback('failed')
    }
  }

  return (
    <div className="relative">
      <button type="button" aria-label="Seite teilen" title="Seite teilen" className={className} onClick={() => void share()}>
        <ShareIcon className="size-7" />
      </button>
      <p
        role="status"
        className={`absolute top-full right-0 mt-2 rounded-xl bg-ink px-3 py-2 text-base font-semibold whitespace-nowrap text-page shadow-lg ${
          feedback ? '' : 'sr-only'
        }`}
      >
        {feedback === 'copied' ? 'Link kopiert' : feedback === 'failed' ? 'Kopieren nicht möglich' : ''}
      </p>
    </div>
  )
}

import { useSyncExternalStore } from 'react'

// "App installieren": Chromium-Browser (Chrome, Edge, Android) melden über beforeinstallprompt,
// dass installiert werden kann. Das Ereignis kommt früh, deshalb wird es beim Laden der App
// abgefangen (Import in main.tsx) und hier für den Einstellungen-Knopf aufbewahrt.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type Platform = 'ios' | 'android' | 'desktop'

export interface InstallState {
  /** App läuft bereits als installierte App */
  installed: boolean
  /** Browser bietet einen Installations-Dialog an */
  canPrompt: boolean
}

let deferredPrompt: BeforeInstallPromptEvent | undefined
let installedNow = false
const listeners = new Set<() => void>()
let snapshot: InstallState = { installed: false, canPrompt: false }

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true
}

function update() {
  snapshot = { installed: installedNow || isStandalone(), canPrompt: deferredPrompt !== undefined }
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // eigener Knopf statt Browser-Hinweis
    deferredPrompt = event as BeforeInstallPromptEvent
    update()
  })
  window.addEventListener('appinstalled', () => {
    installedNow = true
    deferredPrompt = undefined
    update()
  })
  update()
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot,
    () => snapshot,
  )
}

/** Öffnet den Installations-Dialog des Browsers. Liefert true, wenn installiert wurde. */
export async function promptInstall(): Promise<boolean> {
  const prompt = deferredPrompt
  if (!prompt) return false
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  deferredPrompt = undefined // Ein Ereignis kann nur einmal verwendet werden
  update()
  return outcome === 'accepted'
}

export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  // iPadOS meldet sich als Mac, hat aber Touch
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'desktop'
}

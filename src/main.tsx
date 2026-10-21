import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import './index.css'

// Offline-Betrieb: Service Worker registrieren. Bei einem Update übernimmt der neue
// sofort und die Seite lädt einmal neu (Fortschritt und Favoriten liegen in IndexedDB).
registerSW({ immediate: true })

// Nach einem Update kann ein nachgeladener Programmteil der alten Version fehlen: neu laden.
window.addEventListener('vite:preloadError', () => window.location.reload())

const root = document.getElementById('root')
if (!root) throw new Error('Element #root fehlt in index.html')

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)

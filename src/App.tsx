import { Route, Routes } from 'react-router'

// Platzhalter bis zum App-Gerüst (Schritt 3)
function Home() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold">SHK-Assistant</h1>
    </main>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}

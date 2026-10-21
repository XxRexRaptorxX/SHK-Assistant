/** Bietet Text als Datei zum Speichern an (funktioniert offline, ohne Server). */
export function downloadTextFile(fileName: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Etwas warten, manche Browser starten den Download verzögert
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

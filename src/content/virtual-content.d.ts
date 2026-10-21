// Wird beim Build vom Content-Plugin (tools/vite-plugin-content.ts) erzeugt:
// validierte Inhalte, bereits nach Edition gefiltert.
declare module 'virtual:content' {
  const content: import('./collections').ContentData
  export default content
}

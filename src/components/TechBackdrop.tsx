import darkLandscape from '../assets/brand/hintergrund-dunkel-quer.webp'
import darkPortrait from '../assets/brand/hintergrund-dunkel-hoch.webp'
import lightLandscape from '../assets/brand/hintergrund-hell-quer.webp'
import lightPortrait from '../assets/brand/hintergrund-hell-hoch.webp'

// Fotohintergrund (Firmenbilder): je eine Fassung für dunkles und helles Design, jeweils im Hoch-
// und Querformat. Eine Schicht in Seitenfarbe darüber hält Texte gut lesbar. Beim Drucken ausgeblendet.

function Photo({ portrait, landscape, className }: { portrait: string; landscape: string; className: string }) {
  return (
    <picture className={className}>
      <source media="(orientation: portrait)" srcSet={portrait} />
      <img src={landscape} alt="" className="h-full w-full object-cover" />
    </picture>
  )
}

export function TechBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
      <Photo portrait={darkPortrait} landscape={darkLandscape} className="absolute inset-0 hidden dark:block" />
      <Photo portrait={lightPortrait} landscape={lightLandscape} className="absolute inset-0 dark:hidden" />
      <div className="absolute inset-0 bg-page/50 dark:bg-page/40" />
    </div>
  )
}

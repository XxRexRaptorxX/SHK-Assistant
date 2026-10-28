const highlight = 'text-accent'

/**
 * Leitspruch der App (Startseite, Über die App) in den Firmenfarben Blau und Gelb:
 * „Heizungsbauern“ in der Akzentfarbe, der übrige Text in der Gegenfarbe (highlight)
 */
export function Slogan({ className = '' }: { className?: string }) {
  return (
    // Dunkler Schatten hebt die Schrift vom Hintergrundbild ab; Größe wächst mit der Breite,
    // bleibt aber auch auf schmalen Handys (360 px) einzeilig
    <p
      className={`text-[clamp(1rem,4.5vw,1.125rem)] font-bold italic text-highlight [text-shadow:0_1px_1px_rgb(0_0_0/0.9),0_1px_4px_rgb(0_0_0/0.6)] ${className}`}
    >
      Von <span className={highlight}>Heizungsbauern</span>, für <span className={highlight}>Heizungsbauern</span>!
    </p>
  )
}

import type { ComponentType } from 'react'
import {
  BookIcon,
  CalculatorIcon,
  ChecklistIcon,
  ConvertIcon,
  GearIcon,
  KeyIcon,
  NewsIcon,
  OperatorsIcon,
  SearchIcon,
  StarIcon,
  WrenchIcon,
  type IconProps,
} from '../components/icons'

export interface AppModule {
  path: string
  title: string
  description: string
  /** Kürzerer Name für die untere Leiste, falls title dort nicht passt */
  navTitle?: string
  icon: ComponentType<IconProps>
}

// Module der App (Phase 1). Routen, Navigation und Startseite lesen von hier.
export const modules = {
  tools: {
    path: '/tools',
    title: 'Tools',
    description: 'Praktische Rechenhelfer',
    icon: WrenchIcon,
  },
  formulas: {
    path: '/formeln',
    title: 'Formeln',
    description: 'Formelsammlung mit Rechner',
    icon: CalculatorIcon,
  },
  converter: {
    path: '/umrechner',
    title: 'Umrechner',
    description: 'Einheiten umrechnen',
    icon: ConvertIcon,
  },
  checklists: {
    path: '/checklisten',
    title: 'Checklisten',
    description: 'Wartung und Prüfungen abhaken',
    icon: ChecklistIcon,
  },
  lexicon: {
    path: '/lexikon',
    title: 'Lexikon',
    description: 'Bauteile und Begriffe',
    icon: BookIcon,
  },
  calculator: {
    path: '/rechner',
    title: 'Taschenrechner',
    navTitle: 'Rechner',
    description: 'Standard, Wissenschaft, Grafik',
    icon: OperatorsIcon,
  },
  news: {
    path: '/news',
    title: 'News',
    description: 'Branchen-News, täglich aktualisiert',
    icon: NewsIcon,
  },
  expert: {
    path: '/fachmann',
    title: 'Fachmann',
    description: 'Codes für die Fachmann-Ebenen',
    icon: KeyIcon,
  },
  favorites: {
    path: '/favoriten',
    title: 'Favoriten',
    description: 'Gemerkte Einträge',
    icon: StarIcon,
  },
  search: {
    path: '/suche',
    title: 'Suche',
    description: 'In allen Modulen suchen',
    icon: SearchIcon,
  },
  settings: {
    path: '/einstellungen',
    title: 'Einstellungen',
    description: 'Darstellung, Umrechner, App installieren',
    icon: GearIcon,
  },
} satisfies Record<string, AppModule>

/** Untere Navigationsleiste (neben "Start") */
export const bottomNavModules: AppModule[] = [
  modules.tools,
  modules.formulas,
  modules.converter,
  modules.calculator,
  modules.checklists,
  modules.lexicon,
]

/** Kacheln auf der Startseite */
export const homeTileModules: AppModule[] = [
  ...bottomNavModules,
  modules.news,
  modules.expert,
  modules.favorites,
]

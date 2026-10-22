import type { ComponentType } from 'react'
import {
  BookIcon,
  CalculatorIcon,
  ChecklistIcon,
  ConvertIcon,
  GearIcon,
  KeyIcon,
  NewsIcon,
  SearchIcon,
  StarIcon,
  type IconProps,
} from '../components/icons'
import { isInternalEdition } from '../config/edition'

export interface AppModule {
  path: string
  title: string
  description: string
  icon: ComponentType<IconProps>
}

// Module der App (Phase 1). Routen, Navigation und Startseite lesen von hier.
export const modules = {
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
  news: {
    path: '/news',
    title: 'News',
    description: 'Branchen-News, täglich aktualisiert',
    icon: NewsIcon,
  },
  /** Nur in der internen Edition erreichbar (siehe homeTileModules und App) */
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
  modules.formulas,
  modules.converter,
  modules.checklists,
  modules.lexicon,
]

/** Kacheln auf der Startseite */
export const homeTileModules: AppModule[] = [
  ...bottomNavModules,
  modules.news,
  ...(isInternalEdition ? [modules.expert] : []),
  modules.favorites,
]

import {
  BarChart3,
  BookMarked,
  CircleDollarSign,
  Crosshair,
  FileText,
  FolderKanban,
  LayoutGrid,
  Network,
  Settings,
  ShieldAlert,
  Target,
  Timer,
  Wrench
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

export type NavSection = 'home' | 'hunt' | 'earnings' | 'library' | 'system';

export interface NavItemConfig {
  href: string;
  label: string;
  icon: ComponentType;
  match: (pathname: string) => boolean;
  section: NavSection;
  /** Shown in the iPhone-style tab bar (max 4 + "More"). */
  tab?: boolean;
}

export const navSections: Array<{ id: NavSection; label: string | null }> = [
  { id: 'home', label: null },
  { id: 'hunt', label: 'Hunt' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'library', label: 'Library' },
  { id: 'system', label: null }
];

export const navItems: NavItemConfig[] = [
  {
    href: '/dashboard',
    label: 'Today',
    icon: LayoutGrid,
    match: (pathname) => pathname === '/dashboard' || pathname === '/account',
    section: 'home',
    tab: true
  },
  {
    href: '/programs',
    label: 'Programs',
    icon: FolderKanban,
    match: (pathname) => pathname.startsWith('/programs'),
    section: 'hunt',
    tab: true
  },
  {
    href: '/targets',
    label: 'Targets',
    icon: Target,
    match: (pathname) => pathname.startsWith('/targets'),
    section: 'hunt'
  },
  {
    href: '/findings',
    label: 'Findings',
    icon: ShieldAlert,
    match: (pathname) =>
      pathname.startsWith('/findings') || pathname.startsWith('/reports') || pathname.startsWith('/submissions'),
    section: 'hunt',
    tab: true
  },
  {
    href: '/notes',
    label: 'Notes',
    icon: FileText,
    match: (pathname) => pathname.startsWith('/notes'),
    section: 'hunt',
    tab: true
  },
  {
    href: '/timer',
    label: 'Sessions',
    icon: Timer,
    match: (pathname) => pathname.startsWith('/timer') || pathname.startsWith('/sessions'),
    section: 'hunt'
  },
  {
    href: '/payouts',
    label: 'Payouts',
    icon: CircleDollarSign,
    match: (pathname) => pathname.startsWith('/payouts') || pathname.startsWith('/income'),
    section: 'earnings'
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    match: (pathname) => pathname.startsWith('/analytics') || pathname.startsWith('/stats'),
    section: 'earnings'
  },
  {
    href: '/assets',
    label: 'Evidence',
    icon: Network,
    match: (pathname) => pathname.startsWith('/assets'),
    section: 'library'
  },
  {
    href: '/payloads',
    label: 'Payloads',
    icon: Crosshair,
    match: (pathname) => pathname.startsWith('/payloads'),
    section: 'library'
  },
  {
    href: '/bookmarks',
    label: 'References',
    icon: BookMarked,
    match: (pathname) => pathname.startsWith('/bookmarks'),
    section: 'library'
  },
  {
    href: '/tools',
    label: 'Toolkit',
    icon: Wrench,
    match: (pathname) => pathname.startsWith('/tools'),
    section: 'library'
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (pathname) => pathname.startsWith('/settings'),
    section: 'system'
  }
];

export const tabNavItems = navItems.filter((item) => item.tab);

/** @deprecated kept for older imports; use `tabNavItems`. */
export const primaryNavItems = tabNavItems;

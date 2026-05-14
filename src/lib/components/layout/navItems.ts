import {
  BarChart3,
  BookMarked,
  CircleDollarSign,
  Crosshair,
  FileText,
  Flag,
  FolderKanban,
  Network,
  Send,
  Settings,
  ShieldAlert,
  TableProperties,
  Timer,
  Wrench
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

export interface NavItemConfig {
  href: string;
  label: string;
  icon: ComponentType;
  match: (pathname: string) => boolean;
  // primary = visible in mobile bottom nav; all items are visible in side nav
  primary?: boolean;
  section?: 'main' | 'resources';
}

export const navItems: NavItemConfig[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: TableProperties,
    match: (pathname) => pathname === '/dashboard' || pathname === '/account',
    primary: true,
    section: 'main'
  },
  {
    href: '/programs',
    label: 'Programs',
    icon: FolderKanban,
    match: (pathname) => pathname.startsWith('/programs'),
    primary: true,
    section: 'main'
  },
  {
    href: '/targets',
    label: 'Targets',
    icon: Flag,
    match: (pathname) => pathname.startsWith('/targets'),
    primary: true,
    section: 'main'
  },
  {
    href: '/timer',
    label: 'Sessions',
    icon: Timer,
    match: (pathname) => pathname.startsWith('/timer') || pathname.startsWith('/sessions'),
    primary: true,
    section: 'main'
  },
  {
    href: '/notes',
    label: 'Notes',
    icon: FileText,
    match: (pathname) => pathname.startsWith('/notes'),
    primary: true,
    section: 'main'
  },
  {
    href: '/findings',
    label: 'Findings',
    icon: ShieldAlert,
    match: (pathname) => pathname.startsWith('/findings'),
    primary: true,
    section: 'main'
  },
  {
    href: '/reports',
    label: 'Reports',
    icon: Send,
    match: (pathname) => pathname.startsWith('/reports') || pathname.startsWith('/submissions'),
    primary: true,
    section: 'main'
  },
  {
    href: '/payouts',
    label: 'Payouts',
    icon: CircleDollarSign,
    match: (pathname) => pathname.startsWith('/payouts') || pathname.startsWith('/income'),
    primary: true,
    section: 'main'
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    match: (pathname) => pathname.startsWith('/analytics') || pathname.startsWith('/stats'),
    primary: true,
    section: 'main'
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (pathname) => pathname.startsWith('/settings'),
    primary: true,
    section: 'main'
  },
  {
    href: '/assets',
    label: 'Evidence',
    icon: Network,
    match: (pathname) => pathname.startsWith('/assets'),
    primary: false,
    section: 'resources'
  },
  {
    href: '/payloads',
    label: 'Payloads',
    icon: Crosshair,
    match: (pathname) => pathname.startsWith('/payloads'),
    primary: false,
    section: 'resources'
  },
  {
    href: '/bookmarks',
    label: 'References',
    icon: BookMarked,
    match: (pathname) => pathname.startsWith('/bookmarks'),
    primary: false,
    section: 'resources'
  },
  {
    href: '/tools',
    label: 'Toolkit',
    icon: Wrench,
    match: (pathname) => pathname.startsWith('/tools'),
    primary: false,
    section: 'resources'
  }
];

export const primaryNavItems = navItems.filter((item) => item.primary !== false);

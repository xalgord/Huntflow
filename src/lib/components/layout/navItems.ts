import {
  BookMarked,
  Crosshair,
  FileText,
  Flag,
  LayoutDashboard,
  Network,
  Send,
  Settings,
  Sword,
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
}

export const navItems: NavItemConfig[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    match: (pathname) => pathname === '/',
    primary: true
  },
  {
    href: '/timer',
    label: 'Timer',
    icon: Crosshair,
    match: (pathname) => pathname.startsWith('/timer'),
    primary: true
  },
  {
    href: '/targets',
    label: 'Targets',
    icon: Flag,
    match: (pathname) => pathname.startsWith('/targets'),
    primary: true
  },
  {
    href: '/payloads',
    label: 'Payloads',
    icon: Sword,
    match: (pathname) => pathname.startsWith('/payloads'),
    primary: true
  },
  {
    href: '/notes',
    label: 'Notes',
    icon: FileText,
    match: (pathname) => pathname.startsWith('/notes'),
    primary: true
  },
  {
    href: '/submissions',
    label: 'Submissions',
    icon: Send,
    match: (pathname) => pathname.startsWith('/submissions') || pathname.startsWith('/income'),
    primary: true
  },
  {
    href: '/assets',
    label: 'Evidence',
    icon: Network,
    match: (pathname) => pathname.startsWith('/assets'),
    primary: false
  },
  {
    href: '/bookmarks',
    label: 'References',
    icon: BookMarked,
    match: (pathname) => pathname.startsWith('/bookmarks'),
    primary: false
  },
  {
    href: '/tools',
    label: 'Toolkit',
    icon: Wrench,
    match: (pathname) => pathname.startsWith('/tools'),
    primary: false
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (pathname) => pathname.startsWith('/settings'),
    primary: false
  }
];

export const primaryNavItems = navItems.filter((item) => item.primary !== false);

import { Crosshair, DollarSign, FileText, Flag, LayoutDashboard, Network, Settings } from 'lucide-svelte';
import type { ComponentType } from 'svelte';

export interface NavItemConfig {
  href: string;
  label: string;
  icon: ComponentType;
  match: (pathname: string) => boolean;
}

export const navItems: NavItemConfig[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    match: (pathname) => pathname === '/'
  },
  {
    href: '/timer',
    label: 'Timer',
    icon: Crosshair,
    match: (pathname) => pathname.startsWith('/timer')
  },
  {
    href: '/targets',
    label: 'Targets',
    icon: Flag,
    match: (pathname) => pathname.startsWith('/targets')
  },
  {
    href: '/notes',
    label: 'Notes',
    icon: FileText,
    match: (pathname) => pathname.startsWith('/notes')
  },
  {
    href: '/assets',
    label: 'Evidence',
    icon: Network,
    match: (pathname) => pathname.startsWith('/assets')
  },
  {
    href: '/income',
    label: 'Income',
    icon: DollarSign,
    match: (pathname) => pathname.startsWith('/income')
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (pathname) => pathname.startsWith('/settings')
  }
];

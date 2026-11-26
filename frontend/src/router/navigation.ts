import type { Component } from 'vue';
import { Calculator, Clock, LayoutDashboard, Search } from '@lucide/vue';

export interface NavigationItem {
  label: string;
  to: string;
  icon: Component;
}

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Tariff Explorer', to: '/tariffs', icon: Search },
  { label: 'Import Calculator', to: '/calculator', icon: Calculator },
  { label: 'Calculation History', to: '/history', icon: Clock },
];

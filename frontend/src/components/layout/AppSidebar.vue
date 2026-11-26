<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router';
import { Landmark, X } from '@lucide/vue';
import { navigationItems } from '@/router/navigation';

defineProps<{ mobileOpen: boolean; isDesktop: boolean }>();
const emit = defineEmits<{ close: [] }>();

const route = useRoute();

function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

function linkClass(path: string): string {
  return isActive(path)
    ? 'bg-accent-soft text-accent'
    : 'text-ink-muted hover:bg-surface-muted hover:text-ink';
}
</script>

<template>
  <div class="print:hidden">
    <div
      v-if="mobileOpen"
      class="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm lg:hidden print:hidden"
      aria-hidden="true"
      @click="emit('close')"
    />

    <aside
      id="primary-navigation"
      class="print:hidden"
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface transition-transform duration-200 lg:w-64 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
      aria-label="Primary navigation"
      :inert="!isDesktop && !mobileOpen"
      :aria-hidden="!isDesktop && !mobileOpen ? 'true' : undefined"
    >
      <div class="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4">
        <RouterLink
          to="/dashboard"
          class="flex min-w-0 items-center gap-3 rounded-md"
          aria-label="CET Tanzania dashboard"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-contrast"
          >
            <Landmark class="h-5 w-5" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold tracking-tight text-ink">
              CET Tanzania
            </span>
            <span class="block truncate text-[11px] font-medium text-ink-subtle">
              Import Cost Calculator
            </span>
          </span>
        </RouterLink>

        <button
          type="button"
          class="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink lg:hidden"
          aria-label="Close navigation"
          @click="emit('close')"
        >
          <X class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-4">
        <p class="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          Workspace
        </p>
        <ul class="space-y-1">
          <li v-for="item in navigationItems" :key="item.to">
            <RouterLink
              :to="item.to"
              class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              :class="linkClass(item.to)"
              :aria-current="isActive(item.to) ? 'page' : undefined"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ item.label }}</span>
            </RouterLink>
          </li>
        </ul>
      </nav>

      <div class="shrink-0 border-t border-line p-4">
        <p class="mt-3 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
          Tanzania Mainland · API v1
        </p>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { Menu, Moon, Sun } from '@lucide/vue';
import { useThemeStore } from '@/stores/theme';

defineProps<{ navigationOpen: boolean }>();
const emit = defineEmits<{ openNavigation: [] }>();

const route = useRoute();
const themeStore = useThemeStore();
const { isDark } = storeToRefs(themeStore);

const pageTitle = computed(() =>
  typeof route.meta.title === 'string' ? route.meta.title : 'CET Tanzania',
);

const themeActionLabel = computed(() =>
  isDark.value ? 'Switch to light theme' : 'Switch to dark theme',
);
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80 print:hidden"
  >
    <div class="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink lg:hidden"
        aria-label="Open navigation"
        aria-controls="primary-navigation"
        :aria-expanded="navigationOpen"
        @click="emit('openNavigation')"
      >
        <Menu class="h-5 w-5" aria-hidden="true" />
      </button>

      <div class="min-w-0">
        <p class="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle sm:block">
          CET Tanzania
        </p>
        <h1 class="truncate text-base font-semibold tracking-tight text-ink sm:text-lg">
          {{ pageTitle }}
        </h1>
      </div>

      <div class="ml-auto flex items-center gap-2">

        <button
          type="button"
          class="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          :aria-label="themeActionLabel"
          :title="themeActionLabel"
          @click="themeStore.toggleTheme()"
        >
          <Sun v-if="isDark" class="h-4 w-4" aria-hidden="true" />
          <Moon v-else class="h-4 w-4" aria-hidden="true" />
          <span class="hidden xl:inline">{{ isDark ? 'Light' : 'Dark' }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

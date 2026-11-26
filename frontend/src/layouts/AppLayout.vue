<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import { useMediaQuery } from '@/composables/useMediaQuery';

const route = useRoute();
const navigationOpen = ref(false);
const isDesktop = useMediaQuery('(min-width: 1024px)');

function closeNavigation(): void {
  navigationOpen.value = false;
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && navigationOpen.value) closeNavigation();
}

watch(
  () => route.fullPath,
  () => closeNavigation(),
);

watch([navigationOpen, isDesktop], ([open, desktop]) => {
  document.body.style.overflow = open && !desktop ? 'hidden' : '';
});

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="min-h-screen bg-canvas print:bg-white">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-contrast print:hidden"
    >
      Skip to content
    </a>

    <AppSidebar
      :mobile-open="navigationOpen"
      :is-desktop="isDesktop"
      @close="closeNavigation"
    />

    <div class="lg:pl-64 print:pl-0">
      <AppHeader
        :navigation-open="navigationOpen"
        @open-navigation="navigationOpen = true"
      />

      <main id="main-content" class="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 print:px-0 print:py-0">
        <div class="mx-auto w-full max-w-7xl">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>

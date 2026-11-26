import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/** Reactive `window.matchMedia` wrapper used for accessibility state. */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false);
  let mediaQueryList: MediaQueryList | null = null;

  function handleChange(event: MediaQueryListEvent): void {
    matches.value = event.matches;
  }

  onMounted(() => {
    mediaQueryList = window.matchMedia(query);
    matches.value = mediaQueryList.matches;
    mediaQueryList.addEventListener('change', handleChange);
  });

  onBeforeUnmount(() => {
    mediaQueryList?.removeEventListener('change', handleChange);
  });

  return matches;
}

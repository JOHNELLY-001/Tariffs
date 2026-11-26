<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { LoaderCircle, ShieldCheck } from '@lucide/vue';

interface ReviewItem {
  label: string;
  value: string;
}

interface ReviewGroup {
  title: string;
  items: ReviewItem[];
}

const props = defineProps<{
  open: boolean;
  submitting: boolean;
  groups: ReviewGroup[];
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const confirmButtonRef = ref<HTMLButtonElement | null>(null);

let lastFocused: HTMLElement | null = null;
let previousBodyOverflow = '';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function requestClose(): void {
  if (props.submitting) return;
  emit('cancel');
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    requestClose();
    return;
  }
  if (event.key !== 'Tab') return;

  const root = dialogRef.value;
  if (!root) return;

  const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  );
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKeydown);
      await nextTick();
      if (props.open) confirmButtonRef.value?.focus();
      return;
    }

    window.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = previousBodyOverflow;
    lastFocused?.focus();
    lastFocused = null;
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  document.body.style.overflow = previousBodyOverflow;
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[70] overflow-y-auto">
      <div
        class="fixed inset-0 bg-navy/50 backdrop-blur-sm"
        aria-hidden="true"
        @click="requestClose"
      />

      <div class="flex min-h-full items-center justify-center p-4 sm:p-6">
        <section
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-dialog-title"
          aria-describedby="review-dialog-description"
          class="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        >
          <header class="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
            >
              <ShieldCheck class="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div class="min-w-0">
              <h2 id="review-dialog-title" class="text-base font-semibold tracking-tight text-ink">
                Review before submitting
              </h2>
              <p id="review-dialog-description" class="mt-1 text-sm leading-5 text-ink-muted">
                Confirm the request values below. The backend performs valuation, tariff
                resolution and all charge calculations.
              </p>
            </div>
          </header>

          <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div class="grid gap-4 sm:grid-cols-2">
              <section
                v-for="group in groups"
                :key="group.title"
                class="rounded-xl border border-line bg-surface-muted/40 p-4"
              >
                <h3 class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                  {{ group.title }}
                </h3>
                <dl class="mt-3 space-y-2.5">
                  <div v-for="item in group.items" :key="`${group.title}-${item.label}`">
                    <dt class="text-[11px] font-medium text-ink-subtle">{{ item.label }}</dt>
                    <dd class="mt-0.5 break-words text-sm font-medium text-ink">
                      {{ item.value }}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            <p class="mt-4 rounded-lg border border-line bg-surface-muted/50 px-4 py-3 text-xs leading-5 text-ink-muted">
              Submitting sends this request once. The button is disabled while the request is in
              progress to prevent duplicate calculations.
            </p>
          </div>

          <footer class="flex flex-col-reverse gap-2 border-t border-line bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              class="btn-secondary"
              :disabled="submitting"
              @click="emit('cancel')"
            >
              Back to edit
            </button>
            <button
              ref="confirmButtonRef"
              type="button"
              class="btn-primary"
              :disabled="submitting"
              @click="emit('confirm')"
            >
              <LoaderCircle
                v-if="submitting"
                class="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              {{ submitting ? 'Submitting calculation…' : 'Confirm and calculate' }}
            </button>
          </footer>
        </section>
      </div>
    </div>
  </Teleport>
</template>

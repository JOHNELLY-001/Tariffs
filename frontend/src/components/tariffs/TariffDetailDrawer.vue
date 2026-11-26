<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Check, LoaderCircle, RefreshCw, X } from '@lucide/vue';
import InlineNotice from '@/components/common/InlineNotice.vue';
import ScheduleBadge from './ScheduleBadge.vue';
import type { ClassificationContext, RateKind, TariffView } from '@/types/api';

const props = defineProps<{
  open: boolean;
  loading: boolean;
  errorMessage: string | null;
  contextError: string | null;
  tariff: TariffView | null;
  context: ClassificationContext | null;
  selectable?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  retry: [];
  select: [tariff: TariffView];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);

let lastFocused: HTMLElement | null = null;
let previousBodyOverflow = '';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const rateKindLabels: Record<RateKind, string> = {
  percentage: 'Percentage rate',
  specific: 'Specific rate',
  compound: 'Compound rate',
  sensitive_item: 'Sensitive item',
  free: 'Free',
  unknown: 'Rate form not recorded',
};

const ownershipLabels: Record<'chapter' | 'section' | 'unassigned', string> = {
  chapter: 'Chapter note',
  section: 'Section note',
  unassigned: 'Owner not recorded',
};

const isSensitiveRate = computed(() =>
  Boolean(
    props.tariff?.rateAnalysis.isSensitiveItem ||
      (props.tariff?.rate ?? '').trim().toUpperCase() === 'SI',
  ),
);

function pageRange(start: number | null, end: number | null): string {
  if (start === null && end === null) return 'Source page not recorded';
  if (start !== null && end !== null && start !== end) return `Source pp. ${start}–${end}`;
  return `Source p. ${start ?? end}`;
}

function selectCurrent(): void {
  if (props.tariff) emit('select', props.tariff);
}

function trapFocus(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close');
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
      window.addEventListener('keydown', trapFocus);
      await nextTick();
      if (props.open) closeButtonRef.value?.focus();
      return;
    }

    window.removeEventListener('keydown', trapFocus);
    document.body.style.overflow = previousBodyOverflow;
    lastFocused?.focus();
    lastFocused = null;
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', trapFocus);
  document.body.style.overflow = previousBodyOverflow;
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[60]">
      <div
        class="absolute inset-0 bg-navy/50 backdrop-blur-sm"
        aria-hidden="true"
        @click="emit('close')"
      />

      <section
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tariff-detail-title"
        class="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl"
      >
        <header class="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              Tariff line
            </p>
            <h2
              id="tariff-detail-title"
              class="mt-0.5 truncate text-lg font-semibold tracking-tight text-ink"
            >
              {{ tariff ? tariff.hsCode || `Record ${tariff.id}` : 'Tariff details' }}
            </h2>
            <p v-if="tariff" class="mt-0.5 truncate text-xs text-ink-muted">
              {{ tariff.description || 'No description recorded in the source.' }}
            </p>
          </div>

          <button
            ref="closeButtonRef"
            type="button"
            class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="Close tariff details"
            @click="emit('close')"
          >
            <X class="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div
            v-if="loading"
            class="flex items-center gap-3 py-8 text-sm text-ink-muted"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle class="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
            Loading tariff line…
          </div>

          <div v-else-if="errorMessage" class="space-y-4">
            <InlineNotice tone="warning" title="Tariff detail could not be loaded">
              {{ errorMessage }}
            </InlineNotice>
            <button type="button" class="btn-secondary" @click="emit('retry')">
              <RefreshCw class="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>

          <template v-else-if="tariff">
            <!-- Core tariff line -->
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="break-words font-mono text-2xl font-semibold text-ink">
                  {{ tariff.hsCode || '—' }}
                </p>
                <p class="mt-1 text-sm leading-6 text-ink">
                  {{ tariff.description || 'No description recorded in the source.' }}
                </p>
              </div>
              <div class="flex flex-col items-end gap-2">
                <ScheduleBadge :schedule="tariff.scheduleType" />
                <span
                  v-if="isSensitiveRate"
                  class="text-[11px] font-semibold text-warning-ink"
                >
                  Sensitive item
                </span>
              </div>
            </div>

            <dl class="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Rate
                </dt>
                <dd
                  class="mt-0.5 break-words font-mono text-base font-semibold"
                  :class="isSensitiveRate ? 'text-warning-ink' : 'text-ink'"
                >
                  {{ tariff.rate ?? 'Not recorded' }}
                </dd>
                <dd class="mt-0.5 text-[11px] text-ink-subtle">
                  {{ rateKindLabels[tariff.rateAnalysis.kind] }}
                </dd>
              </div>
              <div>
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Chapter
                </dt>
                <dd class="mt-0.5 text-ink">{{ tariff.chapterCode ?? 'Not recorded' }}</dd>
              </div>
              <div>
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Heading
                </dt>
                <dd class="mt-0.5 text-ink">{{ tariff.heading ?? 'Not recorded' }}</dd>
              </div>
              <div>
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Source
                </dt>
                <dd class="mt-0.5 text-ink">
                  {{ pageRange(tariff.sourcePage, tariff.sourcePage) }}
                </dd>
              </div>
              <div v-if="tariff.quantity">
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Quantity basis
                </dt>
                <dd class="mt-0.5 text-ink">{{ tariff.quantity }}</dd>
              </div>
              <div>
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Record
                </dt>
                <dd class="mt-0.5 font-mono text-xs text-ink-muted">#{{ tariff.id }}</dd>
              </div>
            </dl>

            <!-- Classification context -->
            <section class="mt-6 border-t border-line pt-5">
              <h3 class="text-sm font-semibold text-ink">Classification context</h3>

              <div v-if="contextError" class="mt-3">
                <InlineNotice tone="warning" title="Classification context unavailable">
                  {{ contextError }}
                </InlineNotice>
              </div>

              <template v-else-if="context">
                <p v-if="!context.contextComplete" class="mt-2 text-xs leading-5 text-ink-subtle">
                  Chapter and section context are not both available for this tariff line.
                </p>

                <div class="mt-3 space-y-3">
                  <div v-if="context.chapter">
                    <p class="text-sm font-semibold text-ink">
                      {{ context.chapter.chapterCode }} —
                      {{ context.chapter.chapterTitle || 'Title not recorded' }}
                    </p>
                    <p v-if="context.section" class="mt-0.5 text-xs text-ink-muted">
                      Section {{ context.section.sectionCode }} —
                      {{ context.section.sectionTitle || 'Title not recorded' }}
                    </p>
                    <p
                      v-if="context.chapter.chapterNotes"
                      class="mt-2 whitespace-pre-line text-sm leading-6 text-ink-muted"
                    >
                      {{ context.chapter.chapterNotes }}
                    </p>
                  </div>
                  <div v-else-if="context.section">
                    <p class="text-sm font-semibold text-ink">
                      Section {{ context.section.sectionCode }} —
                      {{ context.section.sectionTitle || 'Title not recorded' }}
                    </p>
                    <p
                      v-if="context.section.sectionNotes"
                      class="mt-2 whitespace-pre-line text-sm leading-6 text-ink-muted"
                    >
                      {{ context.section.sectionNotes }}
                    </p>
                  </div>
                  <p v-else class="text-sm text-ink-muted">
                    No chapter or section record was matched for this tariff line.
                  </p>
                </div>

                <details
                  v-if="context.subheadingNotes.length > 0"
                  class="mt-4 border-t border-line pt-3"
                >
                  <summary class="cursor-pointer text-xs font-semibold text-accent">
                    Subheading notes ({{ context.subheadingNotes.length }})
                  </summary>
                  <ul class="mt-3 space-y-3">
                    <li v-for="note in context.subheadingNotes" :key="note.id">
                      <p class="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
                        <span v-if="note.noteNumber">Note {{ note.noteNumber }} · </span>
                        <span v-if="note.subheadingReference" class="font-mono">
                          {{ note.subheadingReference }} · 
                        </span>
                        {{ ownershipLabels[note.ownership] }}
                      </p>
                      <p class="mt-1 whitespace-pre-line text-sm leading-6 text-ink-muted">
                        {{ note.noteText || 'No note text recorded.' }}
                      </p>
                    </li>
                  </ul>
                </details>

                <div v-if="context.sensitiveItemsReference" class="mt-4 border-t border-line pt-3">
                  <p class="text-xs font-semibold text-warning-ink">
                    Sensitive Items reference
                  </p>
                  <p class="mt-1 text-xs leading-5 text-ink-muted">
                    {{ context.sensitiveItemsReference.reason }}
                  </p>

                  <ul
                    v-if="context.sensitiveItemsReference.matches.length > 0"
                    class="mt-2 divide-y divide-line"
                  >
                    <li
                      v-for="match in context.sensitiveItemsReference.matches"
                      :key="match.id"
                      class="flex flex-wrap items-baseline justify-between gap-2 py-2"
                    >
                      <span class="font-mono text-sm font-semibold text-ink">
                        {{ match.hsCode }}
                      </span>
                      <span class="font-mono text-xs font-semibold text-warning-ink">
                        {{ match.rate ?? 'Rate not recorded' }}
                      </span>
                      <ScheduleBadge :schedule="match.scheduleType" />
                    </li>
                  </ul>
                  <p v-else class="mt-1 text-xs text-ink-muted">
                    No Sensitive Items record shares this HS code.
                  </p>
                </div>
              </template>

              <p v-else class="mt-2 text-sm text-ink-muted">
                Classification context has not been loaded.
              </p>
            </section>

            <details
              v-if="tariff.rateAnalysis.components.length > 0"
              class="mt-4 border-t border-line pt-3"
            >
              <summary class="cursor-pointer text-xs font-semibold text-accent">
                Rate components ({{ tariff.rateAnalysis.components.length }})
              </summary>
              <ul class="mt-2 space-y-1">
                <li
                  v-for="(component, index) in tariff.rateAnalysis.components"
                  :key="`${component.kind}-${index}`"
                  class="flex flex-wrap items-baseline gap-2 text-sm"
                >
                  <span class="font-mono text-ink">{{ component.text }}</span>
                  <span class="text-[11px] text-ink-subtle">
                    {{ component.kind.replace(/_/g, ' ') }}
                  </span>
                </li>
              </ul>
            </details>
          </template>
        </div>

        <footer
          v-if="selectable && tariff"
          class="shrink-0 border-t border-line bg-surface px-5 py-4 sm:px-6"
        >
          <button type="button" class="btn-primary w-full" @click="selectCurrent">
            <Check class="h-4 w-4" aria-hidden="true" />
            Use this tariff in the calculator
          </button>
          <p class="mt-2 text-center text-[11px] leading-5 text-ink-subtle">
            Returns to the import calculator with this record selected. Your draft is preserved.
          </p>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

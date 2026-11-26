<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Check, LoaderCircle, RefreshCw, X } from '@lucide/vue';
import InlineNotice from '@/components/common/InlineNotice.vue';
import ScheduleBadge from './ScheduleBadge.vue';
import WarningList from './WarningList.vue';
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
  percentage: 'Percentage',
  specific: 'Specific',
  compound: 'Compound',
  sensitive_item: 'Sensitive Items reference',
  free: 'Free',
  unknown: 'Not classified',
};

const ownershipLabels: Record<'chapter' | 'section' | 'unassigned', string> = {
  chapter: 'Chapter note',
  section: 'Section note',
  unassigned: 'Owner not recorded',
};

const isSensitiveRate = computed(
  () => props.tariff?.rateAnalysis.isSensitiveItem === true,
);

function rateKindLabel(kind: RateKind): string {
  return rateKindLabels[kind];
}

function pageLabel(page: number | null): string {
  return page === null ? 'Not recorded' : String(page);
}

function pageRange(start: number | null, end: number | null): string {
  if (start === null && end === null) return 'Source page not recorded';
  if (start !== null && end !== null && start !== end) return `Source pp. ${start}–${end}`;
  const page = start ?? end;
  return `Source p. ${page}`;
}

function chapterSourceLabel(
  source: ClassificationContext['chapterSource'],
): string {
  if (source === 'verified_column') return 'Chapter linked by a verified column';
  if (source === 'derived_from_hs_code') return 'Chapter derived from the HS code';
  return 'No chapter source';
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
            class="flex items-center gap-3 rounded-lg border border-line bg-surface-muted/50 px-4 py-5 text-sm text-ink-muted"
            role="status"
            aria-live="polite"
          >
            <LoaderCircle class="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
            Loading tariff line and classification context…
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
            <div class="rounded-xl border border-line bg-surface-muted/40 p-4 sm:p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                    HS code
                  </p>
                  <p class="mt-1 break-words font-mono text-xl font-semibold text-ink">
                    {{ tariff.hsCode || '—' }}
                  </p>
                </div>
                <div class="flex flex-col items-end gap-2">
                  <ScheduleBadge :schedule="tariff.scheduleType" />
                  <span
                    v-if="isSensitiveRate"
                    class="inline-flex items-center rounded-full border border-warning/35 bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning-ink"
                  >
                    SI rate reference
                  </span>
                </div>
              </div>

              <p class="mt-3 text-sm leading-6 text-ink">
                {{ tariff.description || 'No description recorded in the source.' }}
              </p>

              <div class="mt-4 rounded-lg border border-line bg-surface p-4">
                <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Recorded rate (original source text)
                </p>
                <p
                  class="mt-1 break-words font-mono text-lg font-semibold"
                  :class="isSensitiveRate ? 'text-warning-ink' : 'text-ink'"
                >
                  {{ tariff.rate ?? 'Not recorded' }}
                </p>
                <p class="mt-1 text-xs leading-5 text-ink-subtle">
                  Derived classification: {{ rateKindLabel(tariff.rateAnalysis.kind) }}.
                  <template v-if="tariff.rateAnalysis.classifiedFromSource">
                    Classified from the stored rate text.
                  </template>
                  The original text above remains authoritative.
                </p>
              </div>
            </div>

            <dl class="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div class="rounded-lg border border-line bg-surface p-3">
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Record ID
                </dt>
                <dd class="mt-1 font-mono text-xs font-semibold text-ink">#{{ tariff.id }}</dd>
              </div>
              <div class="rounded-lg border border-line bg-surface p-3">
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Chapter
                </dt>
                <dd class="mt-1 text-sm text-ink">{{ tariff.chapterCode ?? 'Not recorded' }}</dd>
              </div>
              <div class="rounded-lg border border-line bg-surface p-3">
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Heading
                </dt>
                <dd class="mt-1 text-sm text-ink">{{ tariff.heading ?? 'Not recorded' }}</dd>
              </div>
              <div class="rounded-lg border border-line bg-surface p-3">
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Source page
                </dt>
                <dd class="mt-1 text-sm text-ink">{{ pageLabel(tariff.sourcePage) }}</dd>
              </div>
              <div class="rounded-lg border border-line bg-surface p-3">
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Extraction phase
                </dt>
                <dd class="mt-1 text-sm text-ink">{{ tariff.extractionPhase ?? 'Not recorded' }}</dd>
              </div>
              <div class="rounded-lg border border-line bg-surface p-3">
                <dt class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Quantity
                </dt>
                <dd class="mt-1 text-sm text-ink">{{ tariff.quantity ?? 'Not recorded' }}</dd>
              </div>
            </dl>

            <section class="mt-6 border-t border-line pt-5">
              <h3 class="text-sm font-semibold text-ink">Rate components</h3>
              <p class="mt-1 text-xs leading-5 text-ink-subtle">
                Derived from the recorded text for reference only. No duty or tax is calculated
                here.
              </p>

              <ul
                v-if="tariff.rateAnalysis.components.length > 0"
                class="mt-3 space-y-2"
              >
                <li
                  v-for="(component, index) in tariff.rateAnalysis.components"
                  :key="`${component.kind}-${index}`"
                  class="rounded-lg border border-line bg-surface-muted/40 px-3 py-2.5"
                >
                  <p class="break-words font-mono text-sm text-ink">{{ component.text }}</p>
                  <p class="mt-1 text-[11px] text-ink-subtle">
                    {{ rateKindLabel(component.kind) }}
                    <template v-if="component.value"> · value {{ component.value }}</template>
                    <template v-if="component.currency"> {{ component.currency }}</template>
                    <template v-if="component.unit"> / {{ component.unit }}</template>
                  </p>
                </li>
              </ul>
              <p v-else class="mt-3 text-sm text-ink-muted">
                No rate components were derived from the recorded text.
              </p>

              <div v-if="tariff.rateAnalysis.warnings.length > 0" class="mt-3">
                <WarningList :warnings="tariff.rateAnalysis.warnings" />
              </div>
            </section>

            <section class="mt-6 border-t border-line pt-5">
              <h3 class="text-sm font-semibold text-ink">Classification context</h3>
              <p class="mt-1 text-xs leading-5 text-ink-subtle">
                Chapter, section and subheading guidance recorded in the source. This is
                reference information, not a classification ruling.
              </p>

              <div v-if="contextError" class="mt-3">
                <InlineNotice tone="warning" title="Classification context unavailable">
                  {{ contextError }}
                </InlineNotice>
              </div>

              <template v-else-if="context">
                <div v-if="!context.contextComplete" class="mt-3">
                  <InlineNotice tone="warning" title="Classification context is incomplete">
                    Chapter and section context are not both available for this tariff line.
                    Missing context is reported as unavailable and is not inferred.
                  </InlineNotice>
                </div>

                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <div class="rounded-lg border border-line bg-surface p-4">
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                      Chapter
                    </p>
                    <template v-if="context.chapter">
                      <p class="mt-1 text-sm font-semibold text-ink">
                        {{ context.chapter.chapterCode }} —
                        {{ context.chapter.chapterTitle || 'Title not recorded' }}
                      </p>
                      <p class="mt-1 text-[11px] text-ink-subtle">
                        {{ pageRange(context.chapter.sourcePageStart, context.chapter.sourcePageEnd) }}
                        · {{ chapterSourceLabel(context.chapterSource) }}
                      </p>
                      <p
                        v-if="context.chapter.chapterNotes"
                        class="mt-3 whitespace-pre-line text-sm leading-6 text-ink-muted"
                      >
                        {{ context.chapter.chapterNotes }}
                      </p>
                      <p v-else class="mt-3 text-sm text-ink-subtle">
                        No chapter notes recorded.
                      </p>
                    </template>
                    <p v-else class="mt-1 text-sm text-ink-muted">
                      No chapter record was matched for this tariff line.
                    </p>
                  </div>

                  <div class="rounded-lg border border-line bg-surface p-4">
                    <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                      Section
                    </p>
                    <template v-if="context.section">
                      <p class="mt-1 text-sm font-semibold text-ink">
                        {{ context.section.sectionCode }} —
                        {{ context.section.sectionTitle || 'Title not recorded' }}
                      </p>
                      <p class="mt-1 text-[11px] text-ink-subtle">
                        {{ pageRange(context.section.sourcePageStart, context.section.sourcePageEnd) }}
                      </p>
                      <p
                        v-if="context.section.sectionNotes"
                        class="mt-3 whitespace-pre-line text-sm leading-6 text-ink-muted"
                      >
                        {{ context.section.sectionNotes }}
                      </p>
                      <p v-else class="mt-3 text-sm text-ink-subtle">
                        No section notes recorded.
                      </p>
                    </template>
                    <p v-else class="mt-1 text-sm text-ink-muted">
                      Section context is unavailable or not verified.
                    </p>
                  </div>
                </div>

                <div class="mt-4">
                  <h4 class="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                    Subheading guidance
                  </h4>
                  <ul v-if="context.subheadingNotes.length > 0" class="mt-2 space-y-2">
                    <li
                      v-for="note in context.subheadingNotes"
                      :key="note.id"
                      class="rounded-lg border border-line bg-surface-muted/40 p-3"
                    >
                      <div class="flex flex-wrap items-center gap-2 text-[10px] font-medium text-ink-subtle">
                        <span v-if="note.noteNumber">Note {{ note.noteNumber }}</span>
                        <span v-if="note.subheadingReference" class="font-mono">
                          {{ note.subheadingReference }}
                        </span>
                        <span>{{ ownershipLabels[note.ownership] }}</span>
                        <span>{{ pageRange(note.sourcePageStart, note.sourcePageEnd) }}</span>
                      </div>
                      <p class="mt-2 whitespace-pre-line text-sm leading-6 text-ink-muted">
                        {{ note.noteText || 'No note text recorded.' }}
                      </p>
                    </li>
                  </ul>
                  <p v-else class="mt-2 text-sm text-ink-muted">
                    No subheading notes are recorded for this chapter or section.
                  </p>
                </div>

                <div v-if="context.sensitiveItemsReference" class="mt-4">
                  <InlineNotice tone="warning" title="Sensitive Items cross-reference">
                    {{ context.sensitiveItemsReference.reason }}
                  </InlineNotice>

                  <ul
                    v-if="context.sensitiveItemsReference.matches.length > 0"
                    class="mt-2 space-y-2"
                  >
                    <li
                      v-for="match in context.sensitiveItemsReference.matches"
                      :key="match.id"
                      class="rounded-lg border border-warning/30 bg-warning-soft/40 p-3"
                    >
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <span class="font-mono text-sm font-semibold text-ink">
                          {{ match.hsCode }}
                        </span>
                        <ScheduleBadge :schedule="match.scheduleType" />
                      </div>
                      <p class="mt-1 text-sm leading-6 text-ink-muted">
                        {{ match.description || 'No description recorded in the source.' }}
                      </p>
                      <p class="mt-1 font-mono text-xs font-semibold text-warning-ink">
                        {{ match.rate ?? 'Rate not recorded' }}
                      </p>
                    </li>
                  </ul>
                  <p v-else class="mt-2 text-sm text-ink-muted">
                    No SENSITIVE_ITEMS schedule record shares this HS code.
                  </p>
                </div>

                <div
                  v-if="context.warnings.length > 0"
                  class="mt-4 rounded-lg border border-line bg-surface-muted/40 p-4"
                >
                  <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                    Context warnings
                  </p>
                  <div class="mt-2">
                    <WarningList :warnings="context.warnings" />
                  </div>
                </div>

                <p class="mt-4 text-xs leading-5 text-ink-subtle">{{ context.disclaimer }}</p>
              </template>

              <p v-else class="mt-3 text-sm text-ink-muted">
                Classification context has not been loaded.
              </p>
            </section>
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
            Returns to the import calculator with this record selected. Your draft entries are
            preserved.
          </p>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

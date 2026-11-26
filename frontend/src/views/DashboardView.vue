<script setup lang="ts">
import { RouterLink } from 'vue-router';
import {
  ArrowRight,
  Calculator,
  Clock,
  Landmark,
  ReceiptText,
  Scale,
  Search,
  ShieldCheck,
} from '@lucide/vue';
import BaseCard from '@/components/common/BaseCard.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import PageContainer from '@/components/common/PageContainer.vue';

const workflowSteps = [
  {
    icon: Search,
    title: 'Tariff classification',
    description:
      'Resolve the HS code to candidate tariff lines without automatically choosing between ambiguous records.',
  },
  {
    icon: Scale,
    title: 'Customs valuation',
    description:
      'Combine invoice value, freight, insurance and other costs with a verified exchange rate where required.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified rules only',
    description:
      'Execute duty, excise, VAT and levy rules only when they are verified, effective and applicable.',
  },
  {
    icon: ReceiptText,
    title: 'Charge breakdown',
    description:
      'Report each charge with its base, rate, formula and amount. Payable totals appear only when every required charge resolves.',
  },
];

</script>

<template>
  <PageContainer>
    <section class="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div class="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
      <div class="grid gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-center">
        <div class="max-w-2xl">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
          >
            <Landmark class="h-3.5 w-3.5" aria-hidden="true" />
            Tanzania Mainland
          </span>

          <h2 class="mt-4 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Welcome to the CET Tanzania Import Cost Calculator
          </h2>
          <p class="mt-3 text-sm leading-6 text-ink-muted sm:text-base">
            Explore the tariff schedule and prepare a transparent, auditable import-cost
            breakdown. Every figure is resolved from backend rules — nothing is estimated or
            calculated in the browser.
          </p>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row">
            <RouterLink to="/calculator" class="btn-primary">
              <Calculator class="h-4 w-4" aria-hidden="true" />
              Start an import calculation
              <ArrowRight class="h-4 w-4" aria-hidden="true" />
            </RouterLink>
            <RouterLink to="/tariffs" class="btn-secondary">
              <Search class="h-4 w-4" aria-hidden="true" />
              Explore tariffs
            </RouterLink>
          </div>
        </div>
      </div>
    </section>

    <div class="grid gap-6 xl:grid-cols-3">
      <BaseCard
        class="xl:col-span-2"
        title="Recent calculations"
        description="Saved import-cost calculations will appear here for inspection and reuse."
      >
        <EmptyState
          :icon="Clock"
          title="No calculations yet"
          description="Start an import calculation to prepare a draft. Saved calculations and their audit details will appear in this workspace once persistence is active."
        >
          <template #actions>
            <RouterLink to="/calculator" class="btn-secondary">
              Start a calculation
              <ArrowRight class="h-4 w-4" aria-hidden="true" />
            </RouterLink>
          </template>
        </EmptyState>
      </BaseCard>

      <!-- <BaseCard
        title="Rule status"
        description="Verified Tanzanian tax rules are required before payable totals can be shown."
      >
        <InlineNotice tone="warning" title="No verified tax rules are active">
          Customs duty, excise duty, VAT, RDL, IDL and other charges remain unresolved. The
          backend reports <span class="font-semibold text-ink">needs_review</span> or
          <span class="font-semibold text-ink">unsupported</span> and returns no final totals
          until verified rules are registered.
        </InlineNotice>

        <dl class="mt-4 space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-muted">Rule set</dt>
            <dd class="font-medium text-ink">Unverified draft</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-muted">Production totals</dt>
            <dd class="font-medium text-warning-ink">Unavailable</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-muted">Calculation state</dt>
            <dd class="font-medium text-ink">Review required</dd>
          </div>
        </dl>
      </BaseCard> -->
    </div>

    <BaseCard
      title="How an import cost is prepared"
      description="The workflow separates source facts from verified legal rules and calculated amounts."
    >
      <ol class="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <li
          v-for="(step, index) in workflowSteps"
          :key="step.title"
          class="rounded-lg border border-line bg-surface-muted/40 p-4"
        >
          <div class="flex items-center justify-between">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-accent shadow-sm"
            >
              <component :is="step.icon" class="h-4 w-4" aria-hidden="true" />
            </span>
            <span class="text-xs font-semibold text-ink-subtle">
              {{ String(index + 1).padStart(2, '0') }}
            </span>
          </div>
          <h3 class="mt-3 text-sm font-semibold text-ink">{{ step.title }}</h3>
          <p class="mt-1.5 text-sm leading-6 text-ink-muted">{{ step.description }}</p>
        </li>
      </ol>
    </BaseCard>
  </PageContainer>
</template>

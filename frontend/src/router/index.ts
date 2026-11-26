import { createRouter, createWebHistory } from 'vue-router';
import AppLayout from '@/layouts/AppLayout.vue';
import DashboardView from '@/views/DashboardView.vue';
import TariffExplorerView from '@/views/TariffExplorerView.vue';
import CalculatorView from '@/views/CalculatorView.vue';
import CalculationResultView from '@/views/CalculationResultView.vue';
import HistoryView from '@/views/HistoryView.vue';
import NotFoundView from '@/views/NotFoundView.vue';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    description?: string;
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          redirect: { name: 'dashboard' },
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
          meta: {
            title: 'Dashboard',
            description: 'Overview of the CET Tanzania import-cost workflow.',
          },
        },
        {
          path: 'tariffs',
          name: 'tariffs',
          component: TariffExplorerView,
          meta: {
            title: 'Tariff Explorer',
            description: 'Browse the CET tariff schedule and supporting notes.',
          },
        },
        {
          path: 'calculator',
          name: 'calculator',
          component: CalculatorView,
          meta: {
            title: 'Import Calculator',
            description: 'Prepare an import-cost calculation using verified rules.',
          },
        },
        {
          path: 'calculator/result/:calculationId',
          name: 'calculation-result',
          component: CalculationResultView,
          meta: {
            title: 'Calculation Result',
            description: 'Review the backend response for an import-cost calculation.',
          },
        },
        {
          path: 'history',
          name: 'history',
          component: HistoryView,
          meta: {
            title: 'Calculation History',
            description: 'Inspect previously saved import-cost calculations.',
          },
        },
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: NotFoundView,
          meta: { title: 'Page not found' },
        },
      ],
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : null;
  document.title = title
    ? `${title} · CET Tanzania Import Cost Calculator`
    : 'CET Tanzania Import Cost Calculator';
});

export default router;

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { lazy, Suspense, type ComponentType } from 'react';
import { tokenStore } from '@/shared/api/client';
import { AppShellWithPalette } from './app-shell-with-palette';
import { LoginPage } from '@/pages/login/login-page';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';
import { AdsWorkspacePage } from '@/pages/ads/ads-workspace-page';
import { InboxPage } from '@/pages/inbox/inbox-page';
import { ModulePage } from '@/pages/module/module-page';
import { Skeleton } from '@/shared/ui/skeleton';
import { MODULE_CAPABILITIES } from '@/shared/config/modules';

const CustomersPage = lazy(() => import('@/pages/customers/customers-page').then((m) => ({ default: m.CustomersPage })));
const DealsPage = lazy(() => import('@/pages/deals/deals-page').then((m) => ({ default: m.DealsPage })));
const BudgetPage = lazy(() => import('@/pages/budget/budget-page').then((m) => ({ default: m.BudgetPage })));
const RegionalPage = lazy(() => import('@/pages/regional/regional-page').then((m) => ({ default: m.RegionalPage })));
const AutomationsPage = lazy(() => import('@/pages/automations/automations-page').then((m) => ({ default: m.AutomationsPage })));
const TasksPage = lazy(() => import('@/pages/tasks/tasks-page').then((m) => ({ default: m.TasksPage })));
const HistoryPage = lazy(() => import('@/pages/history/history-page').then((m) => ({ default: m.HistoryPage })));
const ExecutivePage = lazy(() => import('@/pages/executive/executive-page').then((m) => ({ default: m.ExecutivePage })));
const AvitoAccountsPage = lazy(() => import('@/pages/avito/avito-accounts-page').then((m) => ({ default: m.AvitoAccountsPage })));
const AvitoAnalyticsPage = lazy(() => import('@/pages/avito/avito-analytics-page').then((m) => ({ default: m.AvitoAnalyticsPage })));
const AvitoListingGeneratorPage = lazy(() =>
  import('@/pages/avito/avito-listing-generator-page').then((m) => ({ default: m.AvitoListingGeneratorPage })),
);
const AvitoKnowledgePage = lazy(() => import('@/pages/avito/avito-knowledge-page').then((m) => ({ default: m.AvitoKnowledgePage })));
const AvitoRegionalPage = lazy(() => import('@/pages/avito/avito-regional-page').then((m) => ({ default: m.AvitoRegionalPage })));
const AvitoNotificationsPage = lazy(() =>
  import('@/pages/avito/avito-notifications-page').then((m) => ({ default: m.AvitoNotificationsPage })),
);
const AvitoLivePage = lazy(() => import('@/pages/avito/avito-live-page').then((m) => ({ default: m.AvitoLivePage })));
const AvitoOperationsPage = lazy(() =>
  import('@/pages/avito/avito-operations-page').then((m) => ({ default: m.AvitoOperationsPage })),
);
const AvitoSalesPage = lazy(() => import('@/pages/avito/avito-sales-page').then((m) => ({ default: m.AvitoSalesPage })));
const AvitoAutomationPage = lazy(() =>
  import('@/pages/avito/avito-automation-page').then((m) => ({ default: m.AvitoAutomationPage })),
);
const AvitoProductionPage = lazy(() =>
  import('@/pages/avito/avito-production-page').then((m) => ({ default: m.AvitoProductionPage })),
);
const OAuthSettingsPage = lazy(() =>
  import('@/pages/settings/oauth-settings-page').then((m) => ({ default: m.OAuthSettingsPage })),
);
const ConnectionReportPage = lazy(() =>
  import('@/pages/settings/connection-report-page').then((m) => ({ default: m.ConnectionReportPage })),
);
const AiAnalyticsPage = lazy(() => import('@/pages/ai/ai-analytics-page').then((m) => ({ default: m.AiAnalyticsPage })));
const AiAssistantPage = lazy(() => import('@/pages/ai/ai-assistant-page').then((m) => ({ default: m.AiAssistantPage })));
const AiStudioPage = lazy(() => import('@/pages/ai/ai-studio-page').then((m) => ({ default: m.AiStudioPage })));
const AiCostPage = lazy(() => import('@/pages/ai/ai-cost-page').then((m) => ({ default: m.AiCostPage })));
const MediaStudioPage = lazy(() => import('@/pages/media/media-studio-page').then((m) => ({ default: m.MediaStudioPage })));

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Skeleton className="m-6 h-64 rounded-[var(--radius-lg)]" />}>{children}</Suspense>;
}

function lazyRoute(Component: ComponentType) {
  return function LazyRouteComponent() {
    return (
      <Lazy>
        <Component />
      </Lazy>
    );
  };
}

const IMPLEMENTED = new Set([
  '/chats',
  '/customers',
  '/deals',
  '/budget',
  '/analytics/regional',
  '/automations',
  '/history',
  '/tasks',
  '/executive',
  '/ai/generator',
  '/ai/media',
  '/ai/analytics',
  '/ai/assistant',
  '/ai/studio',
  '/ai/cost',
  '/avito/accounts',
  '/avito/analytics',
  '/avito/listing',
  '/avito/knowledge',
  '/avito/regional',
  '/avito/notifications',
  '/avito/live',
  '/avito/operations',
  '/avito/sales',
  '/avito/automation',
  '/avito/production',
  '/media/studio',
  '/settings/oauth',
  '/settings/connection-report',
]);

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: () => {
    if (!tokenStore.get()) throw redirect({ to: '/login' });
  },
  component: AppShellWithPalette,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  component: DashboardPage,
});

const adsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/ads',
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === 'string' ? search.id : undefined,
  }),
  component: AdsWorkspacePage,
});

const executiveRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/executive',
  component: lazyRoute(ExecutivePage),
});

const commerceRoutes = [
  { path: '/chats', component: InboxPage },
  { path: '/customers', component: lazyRoute(CustomersPage) },
  { path: '/deals', component: lazyRoute(DealsPage) },
  { path: '/budget', component: lazyRoute(BudgetPage) },
  { path: '/analytics/regional', component: lazyRoute(RegionalPage) },
  { path: '/automations', component: lazyRoute(AutomationsPage) },
  { path: '/tasks', component: lazyRoute(TasksPage) },
  { path: '/history', component: lazyRoute(HistoryPage) },
].map(({ path, component }) => createRoute({ getParentRoute: () => appLayoutRoute, path, component }));

const aiRoutes = [
  { path: '/ai/generator', component: lazyRoute(AvitoListingGeneratorPage) },
  { path: '/ai/media', component: lazyRoute(MediaStudioPage) },
  { path: '/ai/analytics', component: lazyRoute(AiAnalyticsPage) },
  { path: '/ai/assistant', component: lazyRoute(AiAssistantPage) },
  { path: '/ai/studio', component: lazyRoute(AiStudioPage) },
  { path: '/ai/cost', component: lazyRoute(AiCostPage) },
].map(({ path, component }) => createRoute({ getParentRoute: () => appLayoutRoute, path, component }));

const avitoRoutes = [
  { path: '/avito/accounts', component: lazyRoute(AvitoAccountsPage) },
  { path: '/avito/analytics', component: lazyRoute(AvitoAnalyticsPage) },
  { path: '/avito/listing', component: lazyRoute(AvitoListingGeneratorPage) },
  { path: '/avito/knowledge', component: lazyRoute(AvitoKnowledgePage) },
  { path: '/avito/regional', component: lazyRoute(AvitoRegionalPage) },
  { path: '/avito/notifications', component: lazyRoute(AvitoNotificationsPage) },
  { path: '/avito/live', component: lazyRoute(AvitoLivePage) },
  { path: '/avito/operations', component: lazyRoute(AvitoOperationsPage) },
  { path: '/avito/sales', component: lazyRoute(AvitoSalesPage) },
  { path: '/avito/automation', component: lazyRoute(AvitoAutomationPage) },
  { path: '/avito/production', component: lazyRoute(AvitoProductionPage) },
  { path: '/media/studio', component: lazyRoute(MediaStudioPage) },
].map(({ path, component }) => createRoute({ getParentRoute: () => appLayoutRoute, path, component }));

const settingsRoutes = [
  { path: '/settings/oauth', component: lazyRoute(OAuthSettingsPage) },
  {
    path: '/settings/connection-report',
    validateSearch: (search: Record<string, unknown>) => ({
      accountId: typeof search.accountId === 'string' ? search.accountId : undefined,
    }),
    component: lazyRoute(ConnectionReportPage),
  },
].map(({ path, component, validateSearch }) =>
  createRoute({
    getParentRoute: () => appLayoutRoute,
    path,
    component,
    ...(validateSearch ? { validateSearch } : {}),
  }),
);

const moduleRoutes = Object.entries(MODULE_CAPABILITIES)
  .filter(([path]) => !IMPLEMENTED.has(path))
  .map(([path, def]) =>
    createRoute({
      getParentRoute: () => appLayoutRoute,
      path,
      component: () => <ModulePage title={def.title} path={path} capabilities={def.capabilities} />,
    }),
  );

const routeTree = rootRoute.addChildren([
  loginRoute,
  appLayoutRoute.addChildren([
    dashboardRoute,
    adsRoute,
    executiveRoute,
    ...commerceRoutes,
    ...aiRoutes,
    ...avitoRoutes,
    ...settingsRoutes,
    ...moduleRoutes,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}


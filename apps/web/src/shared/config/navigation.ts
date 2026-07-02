import {
  Activity,
  Bot,
  Boxes,
  Building2,
  CheckSquare,
  Coins,
  FileBarChart,
  FileText,
  FlaskConical,
  Folder,
  Gauge,
  Image,
  LayoutDashboard,
  Map,
  MessagesSquare,
  Plug,
  Settings,
  Sparkles,
  Split,
  Store,
  Target,
  Users,
  Wallet,
  Workflow,
  Wrench,
  BookOpen,
  Bell,
  Link2,
  Crown,
  Film,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** The full Marketplace OS main menu — every module has a real, reachable route. */
export const NAVIGATION: NavGroup[] = [
  {
    label: 'Обзор',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { label: 'Executive Mode', path: '/executive', icon: Crown },
    ],
  },
  {
    label: 'Продажи',
    items: [
      { label: 'Объявления', path: '/ads', icon: Store },
      { label: 'Inbox', path: '/chats', icon: MessagesSquare },
      { label: 'Клиенты', path: '/customers', icon: Users },
      { label: 'Сделки', path: '/deals', icon: Target },
      { label: 'Задачи', path: '/tasks', icon: CheckSquare },
    ],
  },
  {
    label: 'Avito',
    items: [
      { label: 'Account Center', path: '/avito/accounts', icon: Link2 },
      { label: 'Analytics Center', path: '/avito/analytics', icon: Activity },
      { label: 'Listing Generator', path: '/avito/listing', icon: Sparkles },
      { label: 'Regional Publishing', path: '/avito/regional', icon: Map },
      { label: 'Knowledge Base', path: '/avito/knowledge', icon: BookOpen },
      { label: 'Notifications', path: '/avito/notifications', icon: Bell },
    ],
  },
  {
    label: 'AI',
    items: [
      { label: 'AI Studio', path: '/ai/studio', icon: Wrench },
      { label: 'AI Cost Center', path: '/ai/cost', icon: Coins },
      { label: 'AI Генератор', path: '/ai/generator', icon: Sparkles },
      { label: 'Media Studio', path: '/media/studio', icon: Film },
      { label: 'AI Аналитика', path: '/ai/analytics', icon: Activity },
      { label: 'AI Ассистент', path: '/ai/assistant', icon: Bot },
    ],
  },
  {
    label: 'Аналитика',
    items: [
      { label: 'Региональная аналитика', path: '/analytics/regional', icon: Map },
      { label: 'Тепловая карта', path: '/analytics/heatmap', icon: Gauge },
      { label: 'Конкуренты', path: '/competitors', icon: Building2 },
      { label: 'A/B тесты', path: '/ab-tests', icon: Split },
      { label: 'Отчёты', path: '/reports', icon: FileBarChart },
    ],
  },
  {
    label: 'Автоматизация',
    items: [{ label: 'Автоматизации', path: '/automations', icon: Workflow }],
  },
  {
    label: 'Финансы',
    items: [
      { label: 'Бюджет', path: '/budget', icon: Wallet },
      { label: 'Расходы', path: '/expenses', icon: Coins },
    ],
  },
  {
    label: 'Система',
    items: [
      { label: 'История', path: '/history', icon: FileText },
      { label: 'Файлы', path: '/files', icon: Folder },
      { label: 'API', path: '/developer', icon: Plug },
      { label: 'Настройки', path: '/settings', icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAVIGATION.flatMap((g) => g.items);

export const MODULE_META: Record<string, { icon: ComponentType<{ className?: string }>; hint: string }> = {
  '/bulk': { icon: Boxes, hint: 'Массовое изменение цен, статусов и продвижения по тысячам объявлений за один проход.' },
  '/chats': { icon: MessagesSquare, hint: 'Единый инбокс всех площадок с AI-ответами и передачей менеджеру.' },
  '/customers': { icon: Users, hint: 'Профиль клиента с историей переписки, покупок и интересов.' },
  '/deals': { icon: Target, hint: 'Воронка сделок от первого контакта до продажи.' },
  '/ai/generator': { icon: Sparkles, hint: 'Pipeline генерации объявления: анализ → конкуренты → SEO → оптимизация.' },
  '/ai/studio': { icon: Wrench, hint: 'Визуальный конструктор AI-агента на React Flow.' },
  '/ai/cost': { icon: Coins, hint: 'Стоимость AI по моделям, агентам и pipeline.' },
  '/ai/media': { icon: Image, hint: 'Генерация фото, баннеров, инфографики и презентаций.' },
  '/ai/analytics': { icon: Activity, hint: 'AI-аналитик находит, что продаётся, где и почему.' },
  '/ai/assistant': { icon: Bot, hint: 'Ассистент, знающий всю историю клиента и ведущий диалог.' },
  '/analytics/regional': { icon: Map, hint: 'Карта России: CTR, продажи, ROI и средний чек по регионам.' },
  '/analytics/heatmap': { icon: Gauge, hint: 'Тепловая карта интереса покупателей по времени и географии.' },
  '/competitors': { icon: Building2, hint: 'Мониторинг цен и появления/исчезновения объявлений конкурентов.' },
  '/ab-tests': { icon: FlaskConical, hint: 'A/B тесты заголовков, фото, цен и описаний.' },
  '/reports': { icon: FileBarChart, hint: 'Любые отчёты на основе полного потока событий.' },
  '/automations': { icon: Workflow, hint: 'Событийные сценарии: авто-ответ, авто-поднятие, гардрейлы бюджета.' },
  '/budget': { icon: Wallet, hint: 'Планирование и распределение рекламного бюджета.' },
  '/expenses': { icon: Coins, hint: 'Каждый расход — как событие: продвижение, размещение, комиссия.' },
  '/history': { icon: FileText, hint: 'Полная лента событий — воспроизведение истории по секундам.' },
  '/files': { icon: Folder, hint: 'Медиатека на Selectel Object Storage.' },
  '/developer': { icon: Plug, hint: 'REST API, вебхуки и ключи интеграций.' },
  '/settings': { icon: Settings, hint: 'Команда, роли, площадки и параметры аккаунта.' },
};

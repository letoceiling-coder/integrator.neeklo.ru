/** Maps Avito API errors to user-facing messages with remediation hints. */
export function friendlyAvitoError(error: unknown, context: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes('403') || lower.includes('forbidden')) {
    return `${context}: доступ запрещён. Проверьте тариф Avito и scopes в кабинете разработчика. Для Messenger нужен тариф с API мессенджера.`;
  }
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return `${context}: токен недействителен. Переподключите аккаунт через OAuth Settings → Connect.`;
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return `${context}: превышен лимит запросов. Подождите 1–2 минуты и повторите синхронизацию.`;
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return `${context}: ресурс не найден. Возможно, API недоступен для вашего типа аккаунта.`;
  }
  if (lower.includes('scope') || lower.includes('invalid_grant')) {
    return `${context}: недостаточно OAuth scopes. Добавьте нужные права в Avito Developer Portal и переподключите аккаунт.`;
  }
  return `${context}: ${raw}`;
}

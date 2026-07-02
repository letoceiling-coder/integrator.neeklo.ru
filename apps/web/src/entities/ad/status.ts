import { AdStatus } from '@neeklo/contracts';
import type { BadgeProps } from '@/shared/ui/badge';

export const AD_STATUS_LABEL: Record<string, string> = {
  [AdStatus.DRAFT]: 'Черновик',
  [AdStatus.MODERATION]: 'Модерация',
  [AdStatus.ACTIVE]: 'Активно',
  [AdStatus.REJECTED]: 'Отклонено',
  [AdStatus.PAUSED]: 'Пауза',
  [AdStatus.ARCHIVED]: 'Архив',
  [AdStatus.SOLD]: 'Продано',
  [AdStatus.EXPIRED]: 'Истекло',
};

export function statusTone(status: string): NonNullable<BadgeProps['tone']> {
  switch (status) {
    case AdStatus.ACTIVE:
      return 'success';
    case AdStatus.SOLD:
      return 'info';
    case AdStatus.MODERATION:
    case AdStatus.PAUSED:
      return 'warning';
    case AdStatus.REJECTED:
    case AdStatus.EXPIRED:
      return 'danger';
    default:
      return 'neutral';
  }
}

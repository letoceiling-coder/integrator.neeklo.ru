import { Granularity } from '@neeklo/contracts';

/** Returns [periodStart, periodEnd) for a given timestamp and granularity. */
export function periodBounds(at: Date, granularity: Granularity): { start: Date; end: Date } {
  const start = new Date(at);
  start.setMilliseconds(0);
  start.setSeconds(0);

  switch (granularity) {
    case Granularity.HOUR:
      start.setMinutes(0);
      return { start, end: new Date(start.getTime() + 3_600_000) };
    case Granularity.DAY:
      start.setMinutes(0);
      start.setHours(0);
      return { start, end: new Date(start.getTime() + 86_400_000) };
    case Granularity.WEEK: {
      start.setMinutes(0);
      start.setHours(0);
      const day = start.getDay();
      start.setDate(start.getDate() - ((day + 6) % 7));
      return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
    }
    case Granularity.MONTH:
      start.setMinutes(0);
      start.setHours(0);
      start.setDate(1);
      return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
    case Granularity.QUARTER: {
      start.setMinutes(0);
      start.setHours(0);
      start.setDate(1);
      start.setMonth(Math.floor(start.getMonth() / 3) * 3);
      return { start, end: new Date(start.getFullYear(), start.getMonth() + 3, 1) };
    }
    case Granularity.YEAR:
      start.setMinutes(0);
      start.setHours(0);
      start.setDate(1);
      start.setMonth(0);
      return { start, end: new Date(start.getFullYear() + 1, 0, 1) };
    default:
      return periodBounds(at, Granularity.HOUR);
  }
}

/** Rollup chain: hour → day → week → month → quarter → year. */
export const ROLLUP_CHAIN: Record<Granularity, Granularity | null> = {
  [Granularity.HOUR]: Granularity.DAY,
  [Granularity.DAY]: Granularity.WEEK,
  [Granularity.WEEK]: Granularity.MONTH,
  [Granularity.MONTH]: Granularity.QUARTER,
  [Granularity.QUARTER]: Granularity.YEAR,
  [Granularity.YEAR]: null,
};

export interface HistoricalCounters {
  views: number;
  contacts: number;
  messages: number;
  favorites: number;
  spend: number;
  revenue: number;
  events: number;
}

export const EMPTY_COUNTERS: HistoricalCounters = {
  views: 0,
  contacts: 0,
  messages: 0,
  favorites: 0,
  spend: 0,
  revenue: 0,
  events: 0,
};

export function mergeCounters(a: HistoricalCounters, b: Partial<HistoricalCounters>): HistoricalCounters {
  return {
    views: a.views + (b.views ?? 0),
    contacts: a.contacts + (b.contacts ?? 0),
    messages: a.messages + (b.messages ?? 0),
    favorites: a.favorites + (b.favorites ?? 0),
    spend: a.spend + (b.spend ?? 0),
    revenue: a.revenue + (b.revenue ?? 0),
    events: a.events + (b.events ?? 0),
  };
}

/**
 * A tiny Result type so the domain layer can express failure without throwing.
 * Application/HTTP layers translate `Err` into problem responses.
 */
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = DomainError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}
export function unwrap<T, E>(r: Result<T, E>): T {
  if (!r.ok) throw r.error instanceof Error ? r.error : new Error(String(r.error));
  return r.value;
}

/** Base class for expected, business-rule failures (HTTP 4xx-ish). */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ConcurrencyError extends DomainError {
  constructor(expected: number, actual: number) {
    super('concurrency_conflict', `Expected stream version ${expected} but found ${actual}`, {
      expected,
      actual,
    });
    this.name = 'ConcurrencyError';
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string, id: string) {
    super('not_found', `${what} ${id} was not found`, { what, id });
    this.name = 'NotFoundError';
  }
}

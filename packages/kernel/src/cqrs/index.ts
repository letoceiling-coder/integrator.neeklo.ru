/**
 * Minimal, transport-agnostic CQRS contracts.
 *
 * Writes go through the CommandBus (mutate aggregates → append events). Reads go through the
 * QueryBus (hit projections/read-models). They never share a model. The API wires concrete
 * handlers via DI; other transports (queue workers, cron) can reuse the same buses.
 */

// Phantom result type keeps command/query → result mapping type-safe at call sites.
declare const __result: unique symbol;
export interface Command<TResult = void> {
  readonly [__result]?: TResult;
}
export interface Query<TResult> {
  readonly [__result]?: TResult;
}

export type ResultOf<T> = T extends { readonly [__result]?: infer R } ? R : never;

export interface CommandHandler<C extends Command<unknown>> {
  execute(command: C): Promise<ResultOf<C>>;
}
export interface QueryHandler<Q extends Query<unknown>> {
  execute(query: Q): Promise<ResultOf<Q>>;
}

export interface CommandBus {
  execute<C extends Command<unknown>>(command: C): Promise<ResultOf<C>>;
}
export interface QueryBus {
  execute<Q extends Query<unknown>>(query: Q): Promise<ResultOf<Q>>;
}

export const COMMAND_BUS = Symbol('COMMAND_BUS');
export const QUERY_BUS = Symbol('QUERY_BUS');

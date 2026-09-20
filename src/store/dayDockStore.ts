import type { DayDockAction } from "../domain/daydock/actions";
import {
  createInitialDayDockState,
  type DayDockState,
} from "../domain/daydock/model";
import { dayDockReducer } from "../domain/daydock/reducer";

export type PersistenceStatus = "memory" | "durable" | "degraded";

export interface DayDockStore {
  getSnapshot: () => DayDockState;
  getPersistenceStatus: () => PersistenceStatus;
  dispatch: (action: DayDockAction) => void;
  replaceState: (state: DayDockState) => void;
  subscribe: (listener: () => void) => () => void;
}

export interface CreateDayDockStoreOptions {
  getPersistenceStatus?: () => PersistenceStatus;
}

export function createDayDockStore(
  initialState: DayDockState = createInitialDayDockState(),
  {
    getPersistenceStatus = () => "memory",
  }: CreateDayDockStoreOptions = {},
): DayDockStore {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => state,
    getPersistenceStatus,

    dispatch: (action) => {
      const nextState = dayDockReducer(state, action);
      if (nextState === state) return;

      state = nextState;
      listeners.forEach((listener) => listener());
    },

    replaceState: (nextState) => {
      if (nextState === state) return;

      state = nextState;
      listeners.forEach((listener) => listener());
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

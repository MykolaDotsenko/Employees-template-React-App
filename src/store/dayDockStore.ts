import type { DayDockAction } from "../domain/daydock/actions";
import {
  createInitialDayDockState,
  type DayDockState,
} from "../domain/daydock/model";
import { dayDockReducer } from "../domain/daydock/reducer";

export interface DayDockStore {
  getSnapshot: () => DayDockState;
  dispatch: (action: DayDockAction) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createDayDockStore(
  initialState: DayDockState = createInitialDayDockState(),
): DayDockStore {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => state,

    dispatch: (action) => {
      const nextState = dayDockReducer(state, action);
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

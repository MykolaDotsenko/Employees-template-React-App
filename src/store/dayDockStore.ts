import type { DayDockAction } from "../domain/daydock/actions";
import {
  createInitialDayDockState,
  type DayDockState,
} from "../domain/daydock/model";
import { dayDockReducer } from "../domain/daydock/reducer";

export interface DayDockStore {
  getSnapshot: () => DayDockState;
  dispatch: (action: DayDockAction) => void;
  replaceSnapshot: (state: DayDockState) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createDayDockStore(
  initialState: DayDockState = createInitialDayDockState(),
): DayDockStore {
  let state = initialState;
  const listeners = new Set<() => void>();

  function publish(nextState: DayDockState) {
    if (nextState === state) return;

    state = nextState;
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => state,

    dispatch: (action) => {
      publish(dayDockReducer(state, action));
    },

    replaceSnapshot: (nextState) => {
      publish(nextState);
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

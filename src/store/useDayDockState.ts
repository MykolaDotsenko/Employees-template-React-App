import { useSyncExternalStore } from "react";
import type { DayDockState } from "../domain/daydock/model";
import { dayDockStore, type DayDockStore } from "./dayDockStore";

export function useDayDockState(
  store: DayDockStore = dayDockStore,
): DayDockState {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

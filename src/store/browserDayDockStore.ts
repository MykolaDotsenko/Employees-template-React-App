import {
  createPersistentDayDockStore,
} from "../storage/dayDockPersistence";
import { createDayDockStore, type DayDockStore } from "./dayDockStore";
import {
  createSynchronizedDayDockStore,
  DAYDOCK_SYNC_CHANNEL,
  type BroadcastChannelLike,
} from "./synchronizedDayDockStore";

function createBrowserBroadcastChannel(): BroadcastChannelLike {
  const nativeChannel = new BroadcastChannel(DAYDOCK_SYNC_CHANNEL);

  const adapter: BroadcastChannelLike = {
    postMessage: (message) => nativeChannel.postMessage(message),
    onmessage: null,
    close: () => nativeChannel.close(),
  };

  nativeChannel.onmessage = (event) => {
    adapter.onmessage?.({ data: event.data });
  };

  return adapter;
}

function createBrowserDayDockStore(): DayDockStore {
  if (typeof BroadcastChannel === "undefined") {
    return createPersistentDayDockStore({
      storage: window.localStorage,
    });
  }

  return createSynchronizedDayDockStore({
    storage: window.localStorage,
    channel: createBrowserBroadcastChannel(),
  }).store;
}

export const dayDockStore =
  typeof window === "undefined"
    ? createDayDockStore()
    : createBrowserDayDockStore();

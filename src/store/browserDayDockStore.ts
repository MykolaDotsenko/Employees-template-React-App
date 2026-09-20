import {
  createPersistentDayDockStore,
  type StorageLike,
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

export interface BrowserDayDockStoreOptions {
  getStorage?: () => StorageLike;
  createChannel?: () => BroadcastChannelLike | null;
}

export function createBrowserDayDockStore({
  getStorage = () => window.localStorage,
  createChannel,
}: BrowserDayDockStoreOptions = {}): DayDockStore {
  let storage: StorageLike;

  try {
    storage = getStorage();
  } catch {
    return createDayDockStore(undefined, {
      getPersistenceStatus: () => "memory",
    });
  }

  let channel: BroadcastChannelLike | null;

  try {
    channel =
      createChannel !== undefined
        ? createChannel()
        : typeof BroadcastChannel === "undefined"
          ? null
          : createBrowserBroadcastChannel();
  } catch {
    channel = null;
  }

  if (channel === null) {
    return createPersistentDayDockStore({ storage });
  }

  return createSynchronizedDayDockStore({
    storage,
    channel,
  }).store;
}

export const dayDockStore =
  typeof window === "undefined"
    ? createDayDockStore()
    : createBrowserDayDockStore();

import {
  createPersistentDayDockStore,
  type WorkspaceSyncChannel,
} from "../storage/dayDockPersistence";
import { createDayDockStore } from "./dayDockStore";

function createSourceId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function createBrowserSyncChannel(): WorkspaceSyncChannel | undefined {
  if (typeof BroadcastChannel === "undefined") return undefined;

  const channel = new BroadcastChannel("daydock:workspace-sync");

  return {
    postMessage: (message) => {
      channel.postMessage(message);
    },

    subscribe: (listener) => {
      const handler = (event: MessageEvent<unknown>) => {
        listener(event.data);
      };

      channel.addEventListener("message", handler);

      return () => {
        channel.removeEventListener("message", handler);
      };
    },
  };
}

export const dayDockStore =
  typeof window === "undefined"
    ? createDayDockStore()
    : createPersistentDayDockStore({
        storage: window.localStorage,
        syncChannel: createBrowserSyncChannel(),
        sourceId: createSourceId(),
      });

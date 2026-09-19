import {
  createPersistentDayDockStore,
} from "../storage/dayDockPersistence";
import { createDayDockStore } from "./dayDockStore";

export const dayDockStore =
  typeof window === "undefined"
    ? createDayDockStore()
    : createPersistentDayDockStore({ storage: window.localStorage });

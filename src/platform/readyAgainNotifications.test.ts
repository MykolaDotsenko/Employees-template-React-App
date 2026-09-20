import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getReadyAgainNotificationPermission,
  requestReadyAgainNotificationPermission,
  showReadyAgainNotification,
} from "./readyAgainNotifications";

const originalNotification = globalThis.Notification;
const originalServiceWorker = navigator.serviceWorker;

afterEach(() => {
  vi.restoreAllMocks();

  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: originalNotification,
  });

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: originalServiceWorker,
  });
});

function installNotification(
  permission: NotificationPermission,
  requestResult: NotificationPermission = permission,
) {
  class FakeNotification {
    static permission = permission;
    static requestPermission = vi.fn(async () => requestResult);
  }

  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: FakeNotification,
  });

  return FakeNotification;
}

describe("Ready again notifications", () => {
  it("requests permission only through the explicit adapter", async () => {
    const FakeNotification = installNotification("default", "granted");

    expect(getReadyAgainNotificationPermission()).toBe("default");
    await expect(requestReadyAgainNotificationPermission()).resolves.toBe(
      "granted",
    );
    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("uses the service worker for a persistent notification", async () => {
    installNotification("granted");
    const showNotification = vi.fn(async () => undefined);

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn(async () => ({
          showNotification,
        })),
      },
    });

    await expect(showReadyAgainNotification(2)).resolves.toBe(true);
    expect(showNotification).toHaveBeenCalledWith(
      "Ready again in DayDock",
      expect.objectContaining({
        body: "2 items are ready for another look.",
        tag: "daydock-ready-again",
      }),
    );
  });

  it("does not notify without granted permission or a worker", async () => {
    installNotification("denied");

    await expect(showReadyAgainNotification(1)).resolves.toBe(false);
  });
});

export type ReadyAgainNotificationPermission =
  | NotificationPermission
  | "unsupported";

export interface ReadyAgainNotificationResult {
  status: "enabled" | "disabled" | "denied" | "unsupported" | "error";
}

export function getReadyAgainNotificationPermission(): ReadyAgainNotificationPermission {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestReadyAgainNotificationPermission(): Promise<ReadyAgainNotificationPermission> {
  if (typeof Notification === "undefined") return "unsupported";

  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function showReadyAgainNotification(
  count: number,
): Promise<boolean> {
  if (
    count <= 0 ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration(
      import.meta.env.BASE_URL,
    );

    if (!registration) return false;

    await registration.showNotification("Ready again in DayDock", {
      body:
        count === 1
          ? "1 item is ready for another look."
          : `${count} items are ready for another look.`,
      icon: `${import.meta.env.BASE_URL}daydock-192.png`,
      badge: `${import.meta.env.BASE_URL}daydock-192.png`,
      tag: "daydock-ready-again",
      data: {
        url: import.meta.env.BASE_URL,
      },
    });

    return true;
  } catch {
    return false;
  }
}

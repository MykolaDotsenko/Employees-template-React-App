export interface DayDockServiceWorkerConfig {
  scriptUrl: string;
  scope: string;
}

export function getDayDockServiceWorkerConfig(
  baseUrl: string,
): DayDockServiceWorkerConfig {
  const scope = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return {
    scriptUrl: `${scope}service-worker.js`,
    scope,
  };
}

export function registerDayDockServiceWorker(): void {
  if (
    !import.meta.env.PROD ||
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  const config = getDayDockServiceWorkerConfig(import.meta.env.BASE_URL);

  const register = () => {
    void navigator.serviceWorker
      .register(config.scriptUrl, {
        scope: config.scope,
      })
      .catch(() => undefined);
  };

  if (document.readyState === "complete") {
    register();
    return;
  }

  window.addEventListener("load", register, { once: true });
}

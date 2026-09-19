import { describe, expect, it } from "vitest";
import { getDayDockServiceWorkerConfig } from "./serviceWorker";

describe("service worker registration paths", () => {
  it("supports a root deployment", () => {
    expect(getDayDockServiceWorkerConfig("/")).toEqual({
      scriptUrl: "/service-worker.js",
      scope: "/",
    });
  });

  it("normalizes a nested GitHub Pages base path", () => {
    expect(
      getDayDockServiceWorkerConfig("/Employees-template-React-App"),
    ).toEqual({
      scriptUrl: "/Employees-template-React-App/service-worker.js",
      scope: "/Employees-template-React-App/",
    });
  });
});

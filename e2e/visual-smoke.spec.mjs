import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";

const OUTPUT = "visual-smoke";

await mkdir(OUTPUT, { recursive: true });

function buildState(mode = "mature") {
  const now = new Date();
  const iso = (offsetMinutes = 0) =>
    new Date(now.getTime() + offsetMinutes * 60_000).toISOString();
  const dateKey = now.toISOString().slice(0, 10);
  const tomorrowKey = new Date(
    now.getTime() + 24 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10);

  const tasks = {
    release: {
      id: "release",
      title: "Ship DayDock release",
      status: "today",
      estimateMinutes: 50,
      personId: null,
      deferUntil: null,
      recurrence: null,
      createdAt: iso(-180),
      completedAt: null,
    },
    qa: {
      id: "qa",
      title: "Verify mobile release flow",
      status: "today",
      estimateMinutes: 25,
      personId: null,
      deferUntil: null,
      recurrence: null,
      createdAt: iso(-150),
      completedAt: null,
    },
    followup: {
      id: "followup",
      title: "Ask Anna for final copy review",
      status: "later",
      estimateMinutes: null,
      personId: "anna",
      deferUntil: dateKey,
      recurrence: null,
      createdAt: iso(-120),
      completedAt: null,
    },
    later: {
      id: "later",
      title: "Explore richer install screenshots",
      status: "later",
      estimateMinutes: null,
      personId: null,
      deferUntil: tomorrowKey,
      recurrence: {
        kind: "weekly",
        anchorDate: tomorrowKey,
      },
      createdAt: iso(-90),
      completedAt: null,
    },
    done: {
      id: "done",
      title: "Review release checklist",
      status: "done",
      estimateMinutes: 20,
      personId: null,
      deferUntil: null,
      recurrence: null,
      createdAt: iso(-240),
      completedAt: iso(-60),
    },
  };

  return {
    tasks,
    taskOrder: ["release", "qa", "followup", "later", "done"],
    top3: ["release", "qa"],
    people: {
      anna: {
        id: "anna",
        name: "Anna",
        context: "Final release copy and mobile feedback",
        nextFollowUpDate: dateKey,
        createdAt: iso(-1440),
      },
    },
    personOrder: ["anna"],
    focus: {
      active:
        mode === "focus"
          ? {
              id: "focus-release",
              taskId: "release",
              startedAt: iso(-8),
              durationMinutes: 50,
              pausedAt: iso(-1),
              accumulatedPauseMs: 0,
            }
          : null,
      history: [
        {
          id: "focus-done",
          taskId: "done",
          startedAt: iso(-95),
          durationMinutes: 20,
          pausedAt: null,
          accumulatedPauseMs: 0,
          endedAt: iso(-75),
          outcome: "completed",
        },
      ],
    },
    dayPlan: {
      dateKey,
      focusRoomMinutes: 150,
      startedAt: iso(-30),
    },
    calendar: {
      events: [
        {
          id: "calendar-design",
          title: "Design sync",
          startAt: iso(45),
          endAt: iso(90),
          allDay: false,
          source: "ics",
        },
      ],
      importedAt: iso(-20),
      sourceLabel: "work-calendar.ics",
    },
    notifications: {
      readyAgain: mode === "notification-mismatch",
      lastReadyAgainNotifiedDate: null,
    },
    workday: {
      startHour: 8,
      endHour: 18,
    },
  };
}

async function seedWorkspace(page, mode = "mature") {
  const state = buildState(mode);
  const updatedAt = new Date().toISOString();

  await page.addInitScript(
    ({ seededState, seededAt }) => {
      localStorage.setItem(
        "daydock:workspace",
        JSON.stringify({
          schemaVersion: 7,
          updatedAt: seededAt,
          data: seededState,
        }),
      );
    },
    { seededState: state, seededAt: updatedAt },
  );
}

function watchRuntimeErrors(page) {
  const failures = [];

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console.error: ${message.text()}`);
    }
  });

  return () => {
    expect(failures, failures.join("\n")).toEqual([]);
  };
}

async function openFreshWorkspace(page) {
  await page.goto("/");
  await expect(page.getByText("Capture your first item")).toBeVisible();
}

async function openMatureWorkspace(page, mode = "mature") {
  await seedWorkspace(page, mode);
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Ship DayDock release",
      exact: true,
    }).first(),
  ).toBeVisible();
}

test.describe("DayDock visual and release smoke", () => {
  test("first-run desktop, mobile, and narrow-mobile surfaces", async ({
    browser,
  }) => {
    for (const [name, viewport] of [
      ["desktop", { width: 1440, height: 1100 }],
      ["mobile", { width: 390, height: 844 }],
      ["small-mobile", { width: 360, height: 740 }],
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const assertNoRuntimeErrors = watchRuntimeErrors(page);

      await openFreshWorkspace(page);
      await page.screenshot({
        path: `${OUTPUT}/${name}.png`,
        fullPage: true,
      });

      assertNoRuntimeErrors();
      await context.close();
    }
  });

  test("mature Today hierarchy stays stable across viewports", async ({
    browser,
  }) => {
    for (const [name, viewport] of [
      ["mature-desktop", { width: 1440, height: 1100 }],
      ["mature-mobile", { width: 390, height: 844 }],
      ["mature-small-mobile", { width: 360, height: 740 }],
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const assertNoRuntimeErrors = watchRuntimeErrors(page);

      await openMatureWorkspace(page);

      await expect(page.getByText("Top 3", { exact: true })).toBeVisible();
      await expect(page.getByText("Do now", { exact: true })).toBeVisible();
      await expect(page.getByText("Calendar context", { exact: true })).toBeVisible();

      const currentPriority = page
        .getByRole("heading", {
          name: "Ship DayDock release",
          exact: true,
        })
        .first();
      const calendarContext = page.getByText("Calendar context", { exact: true });
      const orderIsCorrect = await page.evaluate(
        ({ currentText, calendarText }) => {
          const elements = [...document.querySelectorAll("body *")];
          const current = elements.find(
            (element) => element.textContent?.trim() === currentText,
          );
          const calendar = elements.find(
            (element) => element.textContent?.trim() === calendarText,
          );

          if (!current || !calendar) return false;

          return Boolean(
            current.compareDocumentPosition(calendar) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          );
        },
        {
          currentText: (await currentPriority.textContent()) ?? "",
          calendarText: (await calendarContext.textContent()) ?? "",
        },
      );

      expect(orderIsCorrect).toBe(true);

      const calendarDetails = page.locator("details.calendar-context-details");
      await expect(calendarDetails).not.toHaveAttribute("open", "");

      await page.screenshot({
        path: `${OUTPUT}/${name}.png`,
        fullPage: true,
      });

      assertNoRuntimeErrors();
      await context.close();
    }
  });

  test("Inbox, People, and Review are directly navigable on mobile", async ({
    browser,
  }) => {
    for (const [surface, fileName] of [
      ["Inbox", "inbox-mobile.png"],
      ["People", "people-mobile.png"],
      ["Review", "review-mobile.png"],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      const assertNoRuntimeErrors = watchRuntimeErrors(page);

      await openMatureWorkspace(page);
      await page.getByRole("button", { name: surface, exact: true }).click();

      if (surface === "People") {
        await expect(page.getByText("Anna", { exact: true })).toBeVisible();
      } else if (surface === "Review") {
        const completedToday = page.locator(
          'section[aria-labelledby="completed-title"]',
        );
        await expect(
          completedToday.getByText("Review release checklist", {
            exact: true,
          }),
        ).toBeVisible();
      } else {
        const readyAgain = page.locator(
          'section[aria-labelledby="ready-again-title"]',
        );
        await expect(
          readyAgain.getByText("Ask Anna for final copy review", {
            exact: true,
          }),
        ).toBeVisible();
      }

      await page.screenshot({
        path: `${OUTPUT}/${fileName}`,
        fullPage: true,
      });

      assertNoRuntimeErrors();
      await context.close();
    }
  });

  test("Focus Mode renders deterministically on desktop and mobile", async ({
    browser,
  }) => {
    for (const [name, viewport] of [
      ["focus-desktop", { width: 1440, height: 1100 }],
      ["focus-mobile", { width: 390, height: 844 }],
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const assertNoRuntimeErrors = watchRuntimeErrors(page);

      await openMatureWorkspace(page, "focus");
      await expect(page.getByText("End session", { exact: true })).toBeVisible();

      await page.screenshot({
        path: `${OUTPUT}/${name}.png`,
        fullPage: true,
      });

      assertNoRuntimeErrors();
      await context.close();
    }
  });

  test("task editing and structural Undo open as real interaction states", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });

    {
      const page = await context.newPage();
      const assertNoRuntimeErrors = watchRuntimeErrors(page);
      await openMatureWorkspace(page);

      await page
        .getByRole("button", {
          name: "Edit or remove Ship DayDock release",
          exact: true,
        })
        .click();

      const dialog = page.locator("dialog.task-editor-dialog[open]");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("heading", {
          name: "Keep the task useful",
          exact: true,
        }),
      ).toBeVisible();
      await expect(dialog.getByLabel("Estimate", { exact: true })).toBeVisible();
      await expect(
        dialog.getByText("Optional minutes", { exact: false }),
      ).toBeVisible();

      await page.screenshot({
        path: `${OUTPUT}/task-editor-mobile.png`,
        fullPage: true,
      });

      assertNoRuntimeErrors();
      await page.close();
    }

    {
      const page = await context.newPage();
      const assertNoRuntimeErrors = watchRuntimeErrors(page);
      await openMatureWorkspace(page);

      await page
        .getByRole("button", {
          name: "Edit or remove Ship DayDock release",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: "Remove…", exact: true }).click();
      await page.getByRole("button", { name: "Remove task", exact: true }).click();

      const undo = page.getByRole("region", { name: "Undo removal" });
      await expect(undo).toBeVisible();
      await expect(page.getByText("Task removed")).toBeVisible();

      await page.screenshot({
        path: `${OUTPUT}/undo-mobile.png`,
        fullPage: true,
      });

      assertNoRuntimeErrors();
      await page.close();
    }

    await context.close();
  });

  test("notification preference mismatch is truthful after restore", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: [],
    });
    const page = await context.newPage();
    const assertNoRuntimeErrors = watchRuntimeErrors(page);

    await openMatureWorkspace(page, "notification-mismatch");
    await page
      .locator('button[aria-label^="Open data and recovery"]')
      .click();

    await expect(page.getByText("Ready again alerts")).toBeVisible();
    await expect(
      page.getByText("Ready again is enabled in this workspace, but", {
        exact: false,
      }),
    ).toBeVisible();

    await page.screenshot({
      path: `${OUTPUT}/notification-mismatch-mobile.png`,
      fullPage: true,
    });

    assertNoRuntimeErrors();
    await context.close();
  });

  test("warmed production shell reopens offline", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const assertNoRuntimeErrors = watchRuntimeErrors(page);

    await openFreshWorkspace(page);
    await page.evaluate(() => navigator.serviceWorker.ready);

    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
      await page.reload();
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    }

    await page.screenshot({
      path: `${OUTPUT}/offline-warm-mobile.png`,
      fullPage: true,
    });

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByText("Capture your first item")).toBeVisible();

    await page.screenshot({
      path: `${OUTPUT}/offline-mobile.png`,
      fullPage: true,
    });

    assertNoRuntimeErrors();
    await context.close();
  });
});

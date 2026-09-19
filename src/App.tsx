import { useMemo, useState } from "react";
import {
  selectFollowUpsDue,
  selectInboxCount,
  selectTasksByStatus,
  selectTop3,
} from "./domain/daydock/selectors";
import { dayDockStore } from "./store/browserDayDockStore";
import type { DayDockStore } from "./store/dayDockStore";
import { useDayDockState } from "./store/useDayDockState";

type Surface = "today" | "inbox" | "people" | "review";

interface AppProps {
  store?: DayDockStore;
}

const NAV_ITEMS: readonly { id: Surface; label: string; hint: string }[] = [
  { id: "today", label: "Today", hint: "What matters now" },
  { id: "inbox", label: "Inbox", hint: "Unsorted thoughts" },
  { id: "people", label: "People", hint: "Follow-ups" },
  { id: "review", label: "Review", hint: "Close the loop" },
];

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function SurfaceIcon({ surface }: { surface: Surface }) {
  const paths: Record<Surface, React.ReactNode> = {
    today: (
      <>
        <circle cx="12" cy="12" r="4.25" />
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
      </>
    ),
    inbox: (
      <>
        <path d="M4 6.5h16v11H4z" />
        <path d="M4 13h4l1.5 2h5L16 13h4" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="16.5" cy="10" r="2.5" />
        <path d="M3.5 19c.5-3.3 2.5-5 5.5-5s5 1.7 5.5 5M14.5 15c2.8.1 4.7 1.4 5.5 4" />
      </>
    ),
    review: (
      <>
        <path d="M5 12.5l4 4L19 6.5" />
        <path d="M4 4h16v16H4z" />
      </>
    ),
  };

  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[surface]}
    </svg>
  );
}

function TodaySurface({
  top3,
  todayCount,
}: {
  top3: ReturnType<typeof selectTop3>;
  todayCount: number;
}) {
  return (
    <div className="surface-stack">
      <section className="intro-block" aria-labelledby="today-title">
        <p className="eyebrow">A clear start</p>
        <h1 id="today-title">Today</h1>
        <p className="intro-copy">
          Keep the day small. Choose up to three outcomes worth finishing.
        </p>
      </section>

      <section className="section-block" aria-labelledby="priorities-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Top 3</p>
            <h2 id="priorities-title">What matters today</h2>
          </div>
          <span className="count-pill">{top3.length} / 3</span>
        </div>

        {top3.length > 0 ? (
          <ol className="priority-list">
            {top3.map((task) => (
              <li key={task.id} className="priority-row">
                <span className="priority-marker" aria-hidden="true" />
                <span className="priority-title">{task.title}</span>
                {task.estimateMinutes !== null ? (
                  <span className="priority-meta">{task.estimateMinutes} min</span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-panel">
            <div className="empty-symbol" aria-hidden="true">○</div>
            <div>
              <h3>A fresh day</h3>
              <p>
                Your first priorities will live here. Quick Capture arrives in the
                next product PR.
              </p>
            </div>
          </div>
        )}

        {todayCount > top3.length ? (
          <p className="supporting-note">
            {todayCount - top3.length} more Today item
            {todayCount - top3.length === 1 ? "" : "s"} waiting outside Top 3.
          </p>
        ) : null}
      </section>

      <section className="now-card" aria-labelledby="now-title">
        <div>
          <p className="section-kicker">Now</p>
          <h2 id="now-title">One thing at a time</h2>
          <p>
            Focus mode will turn the selected priority into a quiet, full attention
            workspace without losing your place.
          </p>
        </div>
        <span className="now-orbit" aria-hidden="true" />
      </section>
    </div>
  );
}

function InboxSurface({
  tasks,
}: {
  tasks: ReturnType<typeof selectTasksByStatus>;
}) {
  return (
    <div className="surface-stack">
      <section className="intro-block">
        <p className="eyebrow">Safe to forget</p>
        <h1>Inbox</h1>
        <p className="intro-copy">
          Capture first. Decide later. Nothing here needs to compete with your focus.
        </p>
      </section>

      {tasks.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-symbol" aria-hidden="true">✓</div>
          <div>
            <h2>Inbox clear</h2>
            <p>Nothing is asking for your attention.</p>
          </div>
        </div>
      ) : (
        <ul className="simple-list">
          {tasks.map((task) => (
            <li key={task.id}>{task.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PeopleSurface({
  duePeople,
}: {
  duePeople: ReturnType<typeof selectFollowUpsDue>;
}) {
  return (
    <div className="surface-stack">
      <section className="intro-block">
        <p className="eyebrow">Things involving other people</p>
        <h1>People</h1>
        <p className="intro-copy">
          Follow-ups stay visible without turning your workday into a CRM.
        </p>
      </section>

      {duePeople.length === 0 ? (
        <div className="empty-panel">
          <div className="empty-symbol" aria-hidden="true">↗</div>
          <div>
            <h2>No follow-ups waiting</h2>
            <p>You are all caught up for today.</p>
          </div>
        </div>
      ) : (
        <ul className="simple-list">
          {duePeople.map((person) => (
            <li key={person.id}>
              <strong>{person.name}</strong>
              {person.context ? <span>{person.context}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewSurface({ completedCount }: { completedCount: number }) {
  return (
    <div className="surface-stack">
      <section className="intro-block">
        <p className="eyebrow">Close the loop</p>
        <h1>Review</h1>
        <p className="intro-copy">
          End the day with closure, not a productivity score.
        </p>
      </section>

      <div className="review-summary">
        <div>
          <span className="review-number">{completedCount}</span>
          <span className="review-label">completed</span>
        </div>
        <p>
          Daily wrap-up and gentle weekly patterns arrive after the core Today flow
          is complete.
        </p>
      </div>
    </div>
  );
}

export function App({ store = dayDockStore }: AppProps) {
  const [surface, setSurface] = useState<Surface>("today");
  const state = useDayDockState(store);

  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);
  const top3 = selectTop3(state);
  const todayTasks = selectTasksByStatus(state, "today");
  const inboxTasks = selectTasksByStatus(state, "inbox");
  const completedTasks = selectTasksByStatus(state, "done");
  const duePeople = selectFollowUpsDue(state, todayKey);
  const inboxCount = selectInboxCount(state);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="app-layout">
        <header className="brand-rail">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              D
            </span>
            <div>
              <strong className="brand-name">DayDock</strong>
              <span className="brand-subtitle">Your day, clearly.</span>
            </div>
          </div>

          <nav className="primary-nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = surface === item.id;
              const badge =
                item.id === "inbox" && inboxCount > 0
                  ? inboxCount
                  : item.id === "people" && duePeople.length > 0
                    ? duePeople.length
                    : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={active ? "nav-item is-active" : "nav-item"}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSurface(item.id)}
                >
                  <SurfaceIcon surface={item.id} />
                  <span className="nav-copy">
                    <span>{item.label}</span>
                    <small>{item.hint}</small>
                  </span>
                  {badge !== null ? <span className="nav-badge">{badge}</span> : null}
                </button>
              );
            })}
          </nav>

          <div className="privacy-note">
            <span className="privacy-dot" aria-hidden="true" />
            <span>
              Local only
              <small>Saved in this browser</small>
            </span>
          </div>
        </header>

        <main id="main-content" className="main-surface">
          <header className="surface-topbar">
            <span>{formatDay(today)}</span>
            <span className="local-badge">Private by default</span>
          </header>

          <div className="surface-content">
            {surface === "today" ? (
              <TodaySurface top3={top3} todayCount={todayTasks.length} />
            ) : null}
            {surface === "inbox" ? <InboxSurface tasks={inboxTasks} /> : null}
            {surface === "people" ? <PeopleSurface duePeople={duePeople} /> : null}
            {surface === "review" ? (
              <ReviewSurface completedCount={completedTasks.length} />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

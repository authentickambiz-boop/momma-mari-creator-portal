import Link from "next/link";
import { dayLabel, type ScheduleEntry } from "@/lib/calendar-view";

export function CalendarBoard({
  view,
  days,
  entries,
  anchor,
  prevHref,
  nextHref,
  weekHref,
  monthHref,
}: {
  view: "week" | "month";
  days: { date: string; inMonth: boolean }[];
  entries: ScheduleEntry[];
  anchor: string;
  prevHref: string;
  nextHref: string;
  weekHref: string;
  monthHref: string;
}) {
  return (
    <section className="card calendar-board" aria-label={view === "week" ? "Week schedule" : "Month schedule"}>
      <div className="calendar-toolbar">
        <Link className="btn ghost" href={prevHref}>Previous</Link>
        <div className="calendar-views">
          <Link className={view === "week" ? "on" : ""} href={weekHref}>Week</Link>
          <Link className={view === "month" ? "on" : ""} href={monthHref}>Month</Link>
        </div>
        <Link className="btn ghost" href={nextHref}>Next</Link>
      </div>
      <p className="note">Showing {dayLabel(anchor)}. Portal dates sit next to Google Calendar. Nothing was emailed.</p>
      <div className={view === "week" ? "cal-grid cal-week" : "cal-grid cal-month"}>
        {days.map((day) => {
          const items = entries.filter((entry) => entry.date === day.date);
          return (
            <article key={day.date} className={day.inMonth ? "cal-day" : "cal-day out"}>
              <h2>{dayLabel(day.date)}</h2>
              {items.length === 0 ? <p className="note">Open</p> : null}
              <ul>
                {items.map((entry) => (
                  <li key={entry.id} className={entry.source === "portal" ? "portal" : "google"}>
                    {entry.time ? <span>{entry.time} </span> : null}
                    {entry.title}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}

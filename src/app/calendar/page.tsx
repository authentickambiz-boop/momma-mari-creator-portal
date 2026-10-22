import { disconnectCalendarAction, saveDeliverableDateAction } from "@/app/calendar-actions";
import { CalendarBoard } from "@/components/calendar-board";
import { PortalFrame } from "@/components/portal-frame";
import { anchorDate, calendarView, monthDates, shiftAnchor, visibleSpan, weekDates } from "@/lib/calendar-view";
import { calendarErrorNote, calendarGoogleNote } from "@/lib/calendar-notes";
import { loadPortal } from "@/lib/current-user";
import { listDueDateDeals } from "@/lib/due-date-deals";
import { withBasePath } from "@/lib/format";
import { calendarLink, calendarOwnerId, creatorSchedule } from "@/lib/google-calendar";

function calendarHref(view: "week" | "month", on: string, creator: string | undefined) {
  const params = new URLSearchParams({ view, on });
  if (creator) params.set("creator", creator);
  return `/calendar?${params.toString()}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; saved?: string; calendarError?: string; view?: string; on?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const staff = portal.viewer.role === "admin" || portal.viewer.role === "manager";
  const deals = staff ? await listDueDateDeals(portal.db, portal.viewer, portal.viewedId) : [];
  const calendarError = calendarErrorNote(params.calendarError);
  const view = calendarView(params.view);
  const anchor = anchorDate(params.on);
  const span = visibleSpan(anchor, view);
  const targetId = portal.viewer.role === "creator"
    ? portal.viewer.creatorId
    : portal.viewedId === "all"
      ? null
      : portal.viewedId;
  const schedule = targetId
    ? await creatorSchedule(portal.db, portal.viewer, targetId, span)
    : null;
  const events = schedule?.ok ? schedule.events : [];
  const days = view === "week"
    ? weekDates(anchor).map((date) => ({ date, inMonth: true }))
    : monthDates(anchor);
  const googleNote = schedule?.ok ? calendarGoogleNote(schedule.google) : null;
  const ownerId = calendarOwnerId(portal.viewer);
  const ownCalendar = ownerId ? await calendarLink(portal.db, ownerId) : null;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="calendar"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <>
          <div className="hello">
            <h1>Calendar</h1>
            <p>Draft and post dates, next to the week from Google Calendar. A reminder lands 3 days ahead, in the portal or in the approval queue. Nothing is emailed on its own.</p>
          </div>
          <section className="card calendar-connect" aria-labelledby="connect-calendar-title">
            <div className="sec-title" id="connect-calendar-title">Your calendar</div>
            {ownCalendar?.linked ? (
              <>
                <p className="note">
                  Connected{ownCalendar.email ? ` as ${ownCalendar.email}` : ""}. The portal only reads your calendar. It does not change events.
                </p>
                <form action={disconnectCalendarAction}>
                  <button className="btn ghost" type="submit">Disconnect calendar</button>
                </form>
              </>
            ) : (
              <>
                <p className="note">Connect the Google Calendar for the account you are signed in with. The portal only asks to read the calendar. It does not change events.</p>
                <a className="btn" href={withBasePath("/api/auth/calendar")}>Connect calendar</a>
              </>
            )}
            {portal.viewer.role === "creator" && ownCalendar?.connected ? (
              <p style={{ marginTop: 10 }}><a href={withBasePath("/api/calendar")}>Download portal dates</a></p>
            ) : null}
          </section>
        </>
      }
    >
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {calendarError ? <p className="private-note">{calendarError}</p> : null}
      {googleNote ? <p className="note">{googleNote}</p> : null}
      {!targetId ? <p className="note">Pick a creator to see her calendar.</p> : null}
      {targetId && events.length === 0 ? <p className="note empty">No due dates yet.</p> : null}
      {targetId ? (
        <CalendarBoard
          view={view}
          days={days}
          entries={events}
          anchor={anchor}
          prevHref={calendarHref(view, shiftAnchor(anchor, view, -1), params.creator)}
          nextHref={calendarHref(view, shiftAnchor(anchor, view, 1), params.creator)}
          weekHref={calendarHref("week", anchor, params.creator)}
          monthHref={calendarHref("month", anchor, params.creator)}
        />
      ) : null}
      {staff && deals.length === 0 ? (
        <section className="card stack calendar-due" style={{ marginTop: 14 }}>
          <div className="sec-title">Set a due date</div>
          <p className="note empty">No brand deals to schedule yet. Bot, no-reply, and GitHub mail stay off this list.</p>
        </section>
      ) : null}
      {staff && deals.length > 0 ? (
        <form action={saveDeliverableDateAction} className="card stack calendar-due" style={{ marginTop: 14 }}>
          <div className="sec-title">Set a due date</div>
          <label>Deal
            <select name="dealId" required defaultValue={deals[0]?.id ?? ""}>
              {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.brand}</option>)}
            </select>
          </label>
          <label>What
            <select name="kind" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="post">Post</option>
            </select>
          </label>
          <label>Due<input type="date" name="dueOn" required /></label>
          <button className="btn" type="submit">Save date</button>
        </form>
      ) : null}
      {staff && schedule?.ok ? (
        <p className="note">{schedule.linked ? "This creator connected Google Calendar. You are seeing her schedule." : "This creator has not connected Google Calendar. Portal dates still show."}</p>
      ) : null}
    </PortalFrame>
  );
}

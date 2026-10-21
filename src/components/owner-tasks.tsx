import { saveCreatorTaskAction } from "@/app/task-actions";
import { TASK_CATEGORIES, TASK_STATUSES, type OwnerTask } from "@/lib/creator-tasks";

export function OwnerTasks({ tasks, note }: { tasks: OwnerTask[]; note?: string | null }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="sec-title">Creator to-dos</div>
      <p className="note">Open to-dos for each creator. Dollar amounts, floors, and staff notes stay off the creator&apos;s list.</p>
      {note ? <p className="note">{note}</p> : null}
      {tasks.length === 0 ? <p className="note empty">No to-dos yet.</p> : tasks.map((task) => (
        <form key={task.id} action={saveCreatorTaskAction} className="stack" style={{ marginTop: 12 }}>
          <p><b>{task.creatorName}</b>{task.overdue && task.status === "open" ? " · Overdue" : ""}</p>
          <input type="hidden" name="id" value={task.id} />
          <label>Title<input name="title" defaultValue={task.title} required /></label>
          <label>Detail<textarea name="detail" rows={2} defaultValue={task.detail ?? ""} /></label>
          <label>Due date<input name="dueDate" type="date" defaultValue={task.dueDate ?? ""} /></label>
          <label>Category
            <select name="category" defaultValue={task.category}>
              {TASK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label>Status
            <select name="status" defaultValue={task.status}>
              {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Save to-do</button>
        </form>
      ))}
    </div>
  );
}

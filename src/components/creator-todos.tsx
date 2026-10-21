import { markTaskDoneAction } from "@/app/task-actions";
import type { CreatorTodo } from "@/lib/creator-tasks";

const CATEGORY_LABELS: Record<string, string> = {
  deal: "Deal",
  goal: "Goal",
  profile: "Profile",
  contract: "Contract",
  content: "Content",
  admin: "Admin",
};

export function CreatorTodos({ tasks, note }: { tasks: CreatorTodo[]; note?: string | null }) {
  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <div className="sec-title">My to-dos</div>
      {note ? <p className="note">{note}</p> : null}
      {tasks.length === 0 ? <p className="note empty">No open to-dos.</p> : (
        <ul className="timeline">
          {tasks.map((task) => (
            <li key={task.id} className={task.overdue ? "task-overdue" : undefined}>
              <b>{task.title}</b>
              <div className="note">{CATEGORY_LABELS[task.category] ?? "To-do"}{task.dueDate ? ` · Due ${task.dueDate}` : ""}</div>
              {task.overdue ? <p className="note alert">Overdue</p> : null}
              {task.detail ? <p>{task.detail}</p> : null}
              <form action={markTaskDoneAction}>
                <input type="hidden" name="id" value={task.id} />
                <button className="btn" type="submit">Mark done</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

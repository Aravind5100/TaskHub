import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../AuthContext";
import {
  ApiError,
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type Task,
  type TaskInput,
} from "../api";
import TaskRow from "../components/TaskRow";

export default function Tasks() {
  const { token, username, logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!token) return;
    listTasks(token)
      .then(setTasks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load tasks."))
      .finally(() => setLoading(false));
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || newTitle.trim() === "") return;
    setCreating(true);
    setError(null);
    try {
      const task = await createTask(token, { title: newTitle.trim() });
      setTasks((prev) => [task, ...prev]);
      setNewTitle("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create task.");
    } finally {
      setCreating(false);
    }
  }

  async function onToggle(task: Task) {
    if (!token) return;
    const updated = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    try {
      await updateTask(token, task.id, { completed: !task.completed });
    } catch {
      // revert on failure
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      setError("Couldn't update task.");
    }
  }

  async function onSave(id: number, input: TaskInput) {
    if (!token) return;
    const updated = await updateTask(token, id, input);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function onDelete(id: number) {
    if (!token) return;
    const prior = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTask(token, id);
    } catch {
      setTasks(prior);
      setError("Couldn't delete task.");
    }
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>TaskHub</h1>
        <div className="who">
          <span>{username}</span>
          <button className="btn-subtle" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <form className="new-task" onSubmit={onCreate}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task…"
          maxLength={200}
        />
        <button className="btn" type="submit" disabled={creating || newTitle.trim() === ""}>
          Add
        </button>
      </form>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">Nothing here yet.</div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={onToggle}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

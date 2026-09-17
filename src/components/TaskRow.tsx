import { useState } from "react";
import type { Task, TaskInput } from "../api";

interface Props {
  task: Task;
  onToggle: (task: Task) => void;
  onSave: (id: number, input: TaskInput) => Promise<void>;
  onDelete: (id: number) => void;
}

export default function TaskRow({ task, onToggle, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(task.id, {
        title,
        description: description.trim() === "" ? null : description,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="task-row">
        <div className="edit-form">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Description (optional)"
          />
          <div className="row">
            <button className="btn" onClick={save} disabled={saving || title.trim() === ""}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="task-row">
      <button
        className={`check${task.completed ? " checked" : ""}`}
        onClick={() => onToggle(task)}
        aria-label={task.completed ? "Mark as not done" : "Mark as done"}
      >
        {task.completed ? "✓" : ""}
      </button>
      <div className="body" onClick={startEdit}>
        <div className={`title${task.completed ? " done" : ""}`}>{task.title}</div>
        {task.description && (
          <div className={`desc${task.completed ? " done" : ""}`}>{task.description}</div>
        )}
      </div>
      <div className="actions">
        <button className="btn-subtle" onClick={startEdit} aria-label="Edit">
          Edit
        </button>
        <button
          className="btn-danger-subtle"
          onClick={() => onDelete(task.id)}
          aria-label="Delete"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

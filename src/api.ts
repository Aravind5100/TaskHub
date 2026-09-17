const BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface User {
  id: number;
  username: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
}

export interface TaskInput {
  title?: string;
  description?: string | null;
  completed?: boolean;
}

// FastAPI/Pydantic 422 errors arrive as { detail: [{ msg, loc, ... }] };
// our own raises (401/404/409) arrive as { detail: "some string" }.
async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      return body.detail.map((d: { msg: string }) => d.msg).join(" ");
    }
  } catch {
    // response wasn't JSON at all
  }
  return `Request failed with status ${res.status}`;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function registerUser(username: string, password: string): Promise<User> {
  return request<User>("/users/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function login(
  username: string,
  password: string,
): Promise<{ access_token: string; token_type: string }> {
  const form = new URLSearchParams();
  form.set("username", username);
  form.set("password", password);

  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res));
  }
  return res.json();
}

export function listTasks(token: string): Promise<Task[]> {
  return request<Task[]>("/tasks/", { token });
}

export function createTask(token: string, input: TaskInput): Promise<Task> {
  return request<Task>("/tasks/", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export function updateTask(token: string, id: number, input: TaskInput): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: "PUT",
    token,
    body: JSON.stringify(input),
  });
}

export function deleteTask(token: string, id: number): Promise<void> {
  return request<void>(`/tasks/${id}`, { method: "DELETE", token });
}

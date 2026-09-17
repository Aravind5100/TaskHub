import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { ApiError } from "../api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/tasks");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="auth-card">
        <h1>TaskHub</h1>
        <p className="subtitle">Sign in to see your tasks.</p>

        {error && <div className="error-text">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn-block" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="switch-line">
          No account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}

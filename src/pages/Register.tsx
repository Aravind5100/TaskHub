import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { ApiError } from "../api";

export default function Register() {
  const { register } = useAuth();
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
      await register(username, password);
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
        <h1>Create an account</h1>
        <p className="subtitle">A few tasks, kept to yourself.</p>

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
            <span className="hint">3–50 characters, letters, numbers, _ and - only.</span>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <span className="hint">At least 8 characters.</span>
          </div>
          <button className="btn btn-block" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="switch-line">
          Already have one? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

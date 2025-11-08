"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Login failed");
      }

      router.push("/progress");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        backgroundColor: "white",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "#1a1a1a", // darker base text color
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <h1
          style={{
            marginBottom: "1rem",
            textAlign: "center",
            color: "#111", // near-black heading
            fontWeight: 700,
          }}
        >
          Welcome back to SignWave
        </h1>

        <p
          style={{
            marginBottom: "2rem",
            textAlign: "center",
            color: "#333", // dark gray for subtitle
          }}
        >
          Log in to continue your ASL practice.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="username"
              style={{
                fontWeight: 600,
                color: "#111",
              }}
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #bbb",
                outline: "none",
                marginTop: "4px",
                transition: "border-color 0.2s, box-shadow 0.2s",
                color: "#111", // darker text in box
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#0070f3";
                e.target.style.boxShadow = "0 0 0 2px rgba(0,118,255,0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#bbb";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="password"
              style={{
                fontWeight: 600,
                color: "#111",
              }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #bbb",
                outline: "none",
                marginTop: "4px",
                transition: "border-color 0.2s, box-shadow 0.2s",
                color: "#111",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#0070f3";
                e.target.style.boxShadow = "0 0 0 2px rgba(0,118,255,0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#bbb";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "6px",
              backgroundColor: "#0070f3",
              color: "white",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#0059c1")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#0070f3")
            }
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        {error && (
          <p
            style={{
              color: "red",
              marginTop: "1rem",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            marginTop: "2rem",
            textAlign: "center",
            color: "#222",
          }}
        >
          Don’t have an account?{" "}
          <a
            href="/register"
            style={{
              color: "#0059c1",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Register here
          </a>
        </p>
      </div>
    </main>
  );
}

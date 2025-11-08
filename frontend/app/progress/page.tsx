"use client";

import { useEffect, useState } from "react";

type ProgressItem = {
    lesson_slug: string;
    lesson_title: string;
    completed: boolean;
    last_score: number | null;
};

// Base lessons you offer in the app
const LESSONS = [
    {
        slug: "asl-alphabet",
        title: "Learn the ABCs",
        description: "Learn the ASL alphabet and practice fingerspelling.",
    },
    {
        slug: "asl-numbers-1-10",
        title: "Numbers 1–10",
        description: "Count from 1 to 10 using ASL.",
    },
    {
        slug: "asl-basic-greetings",
        title: "Basic Greetings",
        description: "Hello, nice to meet you, and more everyday signs.",
    },
];

export default function LessonsPage() {
    const [progress, setProgress] = useState<ProgressItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProgress() {
            try {
                const res = await fetch("http://localhost:8000/api/progress/", {
                    credentials: "include",
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.detail || "Failed to load progress");
                }

                const data = await res.json();
                setProgress(data.progress || []);
            } catch (err: any) {
                setError(err.message || "Something went wrong");
            }
        }

        fetchProgress();
    }, []);

    async function markCompleted(slug: string) {
        try {
            const res = await fetch("http://localhost:8000/api/progress/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    lesson_slug: slug,
                    completed: true,
                    score: 100, // placeholder — you can calculate real scores later
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || "Failed to save progress");
            }

            const updated = await res.json();

            setProgress(prev =>
                prev.some(p => p.lesson_slug === slug)
                    ? prev.map(p =>
                        p.lesson_slug === slug
                            ? {
                                ...p,
                                completed: true,
                                last_score: updated.last_score ?? p.last_score,
                            }
                            : p,
                    )
                    : [
                        ...prev,
                        {
                            lesson_slug: slug,
                            lesson_title:
                                LESSONS.find(l => l.slug === slug)?.title || slug,
                            completed: true,
                            last_score: updated.last_score ?? 100,
                        },
                    ],
            );
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        }
    }

    // Merge base lessons with any saved progress
    const lessonsWithProgress = LESSONS.map(lesson => {
        const p = progress.find(pr => pr.lesson_slug === lesson.slug);
        return {
            ...lesson,
            completed: p?.completed ?? false,
            last_score: p?.last_score ?? null,
        };
    });

    return (
        <main
            style={{
                backgroundColor: "white",
                minHeight: "100vh",
                fontFamily: "system-ui, sans-serif",
                padding: "2rem",
                color: "#000", // make text black
            }}
        >
            <h1
                style={{
                    marginBottom: "0.5rem",
                    fontWeight: 700,
                    color: "#000",
                }}
            >
                Your ASL Lessons
            </h1>
            <p style={{ marginBottom: "1.5rem", color: "#000" }}>
                Tap a lesson to start practicing. Your progress is saved to your account.
            </p>

            {error && (
                <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>
            )}

            <ul
                style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                }}
            >
                {lessonsWithProgress.map(item => (
                    <li
                        key={item.slug}
                        style={{
                            padding: "1rem",
                            borderRadius: "10px",
                            border: "1px solid #ddd",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            cursor: "pointer",
                            backgroundColor: item.completed ? "#e6ffe6" : "#fff",
                        }}
                        // For now clicking the row just marks as complete.
                        // Later you can navigate to `/lessons/[slug]` instead.
                        onClick={() => markCompleted(item.slug)}
                    >
                        <div>
                            <div
                                style={{
                                    fontWeight: 700,
                                    marginBottom: "0.25rem",
                                    color: "#000",
                                }}
                            >
                                {item.title}
                            </div>
                            <div
                                style={{
                                    fontSize: "0.9rem",
                                    color: "#000",
                                }}
                            >
                                {item.description}
                            </div>
                            <div
                                style={{
                                    fontSize: "0.85rem",
                                    marginTop: "0.35rem",
                                    color: "#000",
                                }}
                            >
                                {item.completed
                                    ? `✅ Completed (score: ${item.last_score ?? "N/A"})`
                                    : "⭕ Not completed yet"}
                            </div>
                        </div>
                        {!item.completed && (
                            <button
                                onClick={e => {
                                    e.stopPropagation(); // prevent row click double-firing
                                    markCompleted(item.slug);
                                }}
                                style={{
                                    padding: "0.5rem 0.9rem",
                                    borderRadius: "6px",
                                    border: "none",
                                    backgroundColor: "#0070f3",
                                    color: "#fff",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Start
                            </button>
                        )}
                        {item.completed && (
                            <button
                                onClick={e => {
                                    e.stopPropagation();
                                    // later you could navigate to the lesson here
                                    // e.g. router.push(`/lessons/${item.slug}`)
                                }}
                                style={{
                                    padding: "0.5rem 0.9rem",
                                    borderRadius: "6px",
                                    border: "1px solid #0070f3",
                                    backgroundColor: "#fff",
                                    color: "#0070f3",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Review
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </main>
    );
}

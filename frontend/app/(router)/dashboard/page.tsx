"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
        <main className="flex min-h-screen w-full bg-background px-4 py-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Your ASL Lessons
                    </h1>
                    <p className="text-muted-foreground">
                        Tap a lesson to start practicing. Your progress is saved to your account.
                    </p>
                </div>

                {error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <div className="grid gap-4">
                    {lessonsWithProgress.map(item => (
                        <Card
                            key={item.slug}
                            role="button"
                            tabIndex={0}
                            onClick={() => markCompleted(item.slug)}
                            onKeyDown={event => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    markCompleted(item.slug);
                                }
                            }}
                            className={cn(
                                "transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                "cursor-pointer",
                                item.completed
                                    ? "border-emerald-500/40 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/30"
                                    : "",
                            )}
                        >
                            <CardContent className="flex items-center justify-between gap-4 py-5">
                                <div className="space-y-2 flex-1">
                                    <CardTitle className="text-xl font-semibold">
                                        {item.title}
                                    </CardTitle>
                                    <CardDescription className="text-sm">
                                        {item.description}
                                    </CardDescription>
                                    <p className="text-sm font-medium">
                                        {item.completed
                                            ? `✅ Completed (score: ${item.last_score ?? "N/A"})`
                                            : "⭕ Not completed yet"}
                                    </p>
                                </div>

                                {!item.completed ? (
                                    <Button
                                        onClick={event => {
                                            event.stopPropagation();
                                            markCompleted(item.slug);
                                        }}
                                        className="shrink-0"
                                    >
                                        Start
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        onClick={event => {
                                            event.stopPropagation();
                                            // TODO: navigate to the lesson when available
                                        }}
                                        className="shrink-0"
                                    >
                                        Review
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </main>
    );
}

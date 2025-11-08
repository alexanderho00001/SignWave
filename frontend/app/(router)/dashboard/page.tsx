'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ProgressItem = {
    lesson_slug: string;
    lesson_title: string;
    completed: boolean;
    last_score: number | null;
};

// Base lessons you offer in the app
const LESSONS = [
    {
        slug: 'asl-alphabet',
        title: 'Learn the ABCs',
        description: 'Learn the ASL alphabet and practice fingerspelling.',
    },
    {
        slug: 'asl-numbers-1-10',
        title: 'Numbers 1–10',
        description: 'Count from 1 to 10 using ASL.',
    },
    {
        slug: 'game-asl-alphabet',
        title: 'Alphabet Exercise',
        description: 'Practice the alphabet with a game.',
    },
    {
        slug: 'game-asl-numbers',
        title: 'Numbers Exercise',
        description: 'Practice the numbers with simple arithmetic.',
    },
];

// Map lesson slugs to their routes
const getRouteForSlug = (slug: string): string => {
    if (slug === 'asl-alphabet') {
        return '/lessons/asl-alphabet';
    } else if (slug === 'asl-numbers-1-10') {
        return '/lessons/asl-numbers';
    } else if (slug === 'game-asl-alphabet') {
        return '/games/asl-alphabet';
    } else if (slug === 'game-asl-numbers') {
        return '/games/asl-numbers';
    }
    return '/dashboard';
};

export default function LessonsPage() {
    const router = useRouter();
    const [progress, setProgress] = useState<ProgressItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchProgress() {
            try {
                const res = await fetch('http://localhost:8000/api/progress/', {
                    credentials: 'include',
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.detail || 'Failed to load progress');
                }

                const data = await res.json();
                setProgress(data.progress || []);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                setError(err.message || 'Something went wrong');
            }
        }

        fetchProgress();
    }, []);

    async function markCompleted(slug: string) {
        try {
            const res = await fetch('http://localhost:8000/api/progress/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    lesson_slug: slug,
                    completed: true,
                    score: 100, // placeholder — you can calculate real scores later
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.detail || 'Failed to save progress');
            }

            const updated = await res.json();

            setProgress((prev) =>
                prev.some((p) => p.lesson_slug === slug)
                    ? prev.map((p) =>
                          p.lesson_slug === slug
                              ? {
                                    ...p,
                                    completed: true,
                                    last_score: updated.last_score ?? p.last_score,
                                }
                              : p
                      )
                    : [
                          ...prev,
                          {
                              lesson_slug: slug,
                              lesson_title: LESSONS.find((l) => l.slug === slug)?.title || slug,
                              completed: true,
                              last_score: updated.last_score ?? 100,
                          },
                      ]
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        }
    }

    // Merge base lessons with any saved progress
    const lessonsWithProgress = LESSONS.map((lesson) => {
        const p = progress.find((pr) => pr.lesson_slug === lesson.slug);
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
                    <h1 className="text-3xl font-semibold tracking-tight">Your ASL Lessons</h1>
                    <p className="text-muted-foreground">
                        Tap a lesson to start practicing. Your progress is saved to your account.
                    </p>
                </div>

                {error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lessonsWithProgress.map((item) => (
                        <Card
                            key={item.slug}
                            className={cn(
                                'transition-all hover:border-primary/40 hover:shadow-sm',
                                item.completed
                                    ? 'border-emerald-500/40 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/30'
                                    : ''
                            )}>
                            <CardContent className="flex items-center justify-between gap-3 py-3">
                                <div className="space-y-1 flex-1 min-w-0">
                                    <CardTitle className="text-lg font-semibold">{item.title}</CardTitle>
                                    <CardDescription className="text-xs">{item.description}</CardDescription>
                                    <p className="text-xs font-medium">
                                        {item.completed
                                            ? `✅ Completed (score: ${item.last_score ?? 'N/A'})`
                                            : '⭕ Not completed yet'}
                                    </p>
                                </div>

                                {!item.completed ? (
                                    <Button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            const route = getRouteForSlug(item.slug);
                                            router.push(route);
                                        }}
                                        size="sm"
                                        className="shrink-0 cursor-pointer">
                                        Start
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            const route = getRouteForSlug(item.slug);
                                            router.push(route);
                                        }}
                                        className="shrink-0 cursor-pointer">
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

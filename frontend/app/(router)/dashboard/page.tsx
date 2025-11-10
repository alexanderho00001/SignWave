'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
        link: '/lessons/asl-alphabet',
        title: 'Learn the ABCs',
        description: 'Learn the ASL alphabet and practice fingerspelling.',
    },
    {
        slug: 'asl-numbers-1-10',
        title: 'Numbers 1–10',
        link: '/lessons/asl-numbers',
        description: 'Count from 1 to 10 using ASL.',
    },
    {
        slug: 'asl-basic-words',
        title: 'Learn Basic Words',
        link: '/lessons/asl-basics',
        description: 'Learn basic words and practice fingerspelling.',
    },
    {
        slug: 'game-asl-alphabet',
        title: 'Alphabet Exercise',
        link: '/games/asl-alphabet',
        description: 'Practice the alphabet with a game.',
    },
    {
        slug: 'game-asl-numbers',
        title: 'Numbers Exercise',
        link: '/games/asl-numbers',
        description: 'Practice the numbers with simple arithmetic.',
    },
    {
        slug: 'game-asl-basic-words',
        title: 'Basic Words Exercise',
        link: '/games/asl-basics',
        description: 'Practice basic words with a game.',
    }
];

// Map lesson slugs to their routes
const getRouteForLink = (link: string): string => {
    return link;
};

// Generate a unique 8-character room code
function generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function LessonsPage() {
    const router = useRouter();
    const [progress, setProgress] = useState<ProgressItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hostGameDialogOpen, setHostGameDialogOpen] = useState(false);
    const [gameMode, setGameMode] = useState<'select' | 'host' | 'join'>('select');
    const [roomCode, setRoomCode] = useState<string>('');
    const [joinRoomCode, setJoinRoomCode] = useState<string>('');
    const [goalScore, setGoalScore] = useState<number>(10);
    const [creating, setCreating] = useState(false);
    const [joining, setJoining] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [joinError, setJoinError] = useState<string | null>(null);

    useEffect(() => {
        // Progress tracking is currently not implemented in Next.js API routes
        // For now, progress is stored locally or can be added later
        // Set empty progress array - lessons will show as not completed
        setProgress([]);
    }, []);

    async function markCompleted(slug: string) {
        // Progress tracking is currently not implemented in Next.js API routes
        // For now, update local state only
        // TODO: Implement progress API route if needed
        setProgress((prev) =>
            prev.some((p) => p.lesson_slug === slug)
                ? prev.map((p) =>
                      p.lesson_slug === slug
                          ? {
                                ...p,
                                completed: true,
                                last_score: 100,
                            }
                          : p
                  )
                : [
                      ...prev,
                      {
                          lesson_slug: slug,
                          lesson_title: LESSONS.find((l) => l.slug === slug)?.title || slug,
                          completed: true,
                          last_score: 100,
                      },
                  ]
        );
    }

    // Get current user ID (you'll need to implement this based on your auth system)
    const getCurrentUserId = () => {
        // TODO: Replace with actual user ID from auth context
        return localStorage.getItem('userId') || '';
    };

    const getCurrentUserName = () => {
        // TODO: Replace with actual user name from auth context
        return localStorage.getItem('userName') || 'Player';
    };

    // Open game dialog with mode selection
    const handleOpenHostDialog = () => {
        setGameMode('select');
        setRoomCode(generateRoomCode());
        setJoinRoomCode('');
        setGoalScore(10);
        setCreateError(null);
        setJoinError(null);
        setHostGameDialogOpen(true);
    };

    // Join room
    const handleJoinRoom = async () => {
        if (!joinRoomCode || joinRoomCode.trim().length !== 8) {
            setJoinError('Please enter a valid 8-character room code');
            return;
        }

        setJoining(true);
        setJoinError(null);

        try {
            const userId = getCurrentUserId();
            const userName = getCurrentUserName();

            if (!userId) {
                throw new Error('User not logged in');
            }

            const response = await fetch(`/api/room/${joinRoomCode.toUpperCase()}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guest_id: userId,
                    guest_name: userName,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to join room');
            }

            setHostGameDialogOpen(false);
            // Navigate to the competition page
            router.push(`/games/asl-competition?room=${joinRoomCode.toUpperCase()}`);
        } catch (err) {
            setJoinError(err instanceof Error ? err.message : 'Failed to join room');
        } finally {
            setJoining(false);
        }
    };

    // Create room
    const handleCreateRoom = async () => {
        if (goalScore < 1 || goalScore > 20) {
            setCreateError('Goal score must be between 1 and 20');
            return;
        }

        setCreating(true);
        setCreateError(null);

        try {
            const userId = getCurrentUserId();
            const userName = getCurrentUserName();

            if (!userId) {
                throw new Error('User not logged in');
            }

            const response = await fetch('/api/room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    host_id: userId,
                    host_name: userName,
                    goal_score: goalScore,
                    room_code: roomCode,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                const errorMessage = data.error || 'Failed to create room';
                
                // If room code already exists, regenerate it and show error
                if (response.status === 409 && errorMessage.includes('already exists')) {
                    setRoomCode(generateRoomCode());
                    setCreateError('Room code already exists. A new code has been generated. Please try again.');
                } else {
                    throw new Error(errorMessage);
                }
                return;
            }

            const data = await response.json();
            setHostGameDialogOpen(false);
            // Navigate to the competition page
            router.push(`/games/asl-competition?room=${data.room.room_code}`);
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : 'Failed to create room');
        } finally {
            setCreating(false);
        }
    };

    // Merge base lessons with any saved progress
    const lessonsWithProgress = LESSONS.map((lesson) => {
        const p = progress.find((pr) => pr.lesson_slug === lesson.slug);
        return {
            ...lesson,
            completed: p?.completed ?? false,
            last_score: p?.last_score ?? null,
        };
    });

    // Handle sign out
    const handleSignOut = async () => {
        try {
            // Call logout API to clear cookies
            await fetch('/api/auth/logout', {
                method: 'GET',
                credentials: 'include',
            });

            // Clear localStorage
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
            localStorage.removeItem('username');

            // Redirect to login page
            router.push('/');
        } catch (error) {
            console.error('Error during sign out:', error);
            // Even if API fails, clear localStorage and redirect
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
            localStorage.removeItem('username');
            router.push('/');
        }
    };

    return (
        <main className="flex min-h-screen w-full bg-background px-4 py-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-semibold tracking-tight">Your ASL Lessons</h1>
                        <p className="text-muted-foreground">
                            Tap a lesson to start practicing. Your progress is saved to your account.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="shrink-0"
                    >
                        Sign Out
                    </Button>
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
                                            const route = getRouteForLink(item.link);
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
                                            const route = getRouteForLink(item.slug);
                                            router.push(item.link);
                                        }}
                                        className="shrink-0 cursor-pointer">
                                        Review
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer" onClick={handleOpenHostDialog}>
                    <CardContent className="flex items-center justify-between gap-3 py-4 px-6">
                        <div className="flex-1">
                            <CardTitle className="text-lg font-semibold">Start a Practice Game with your friends!</CardTitle>
                            <CardDescription className="text-sm">Create a room and invite others to practice ASL together</CardDescription>
                        </div>
                        <Button size="sm" className="shrink-0">
                            Start
                        </Button>
                    </CardContent>
                </Card>

                <Dialog open={hostGameDialogOpen} onOpenChange={setHostGameDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {gameMode === 'select' && 'Start a Practice Game'}
                                {gameMode === 'host' && 'Host a Practice Game'}
                                {gameMode === 'join' && 'Join a Practice Game'}
                            </DialogTitle>
                            <DialogDescription>
                                {gameMode === 'select' && 'Choose to host a new game or join an existing one.'}
                                {gameMode === 'host' && 'Create a room for practicing ASL with others. Share the room code with your friends!'}
                                {gameMode === 'join' && 'Enter the room code provided by the host to join their game.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            {gameMode === 'select' && (
                                <div className="flex flex-col gap-3">
                                    <Button
                                        onClick={() => setGameMode('host')}
                                        className="w-full"
                                        size="lg"
                                    >
                                        Host a Game
                                    </Button>
                                    <Button
                                        onClick={() => setGameMode('join')}
                                        variant="outline"
                                        className="w-full"
                                        size="lg"
                                    >
                                        Join a Game
                                    </Button>
                                </div>
                            )}

                            {gameMode === 'host' && (
                                <>
                                    {/* Room Code Preview */}
                                    <div className="space-y-2">
                                        <Label htmlFor="room-code">Room Code Preview</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                id="room-code"
                                                value={roomCode}
                                                readOnly
                                                className="font-mono text-lg text-center font-bold bg-muted"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setRoomCode(generateRoomCode())}
                                            >
                                                Regenerate
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Preview of room code. Actual code will be generated when you create the room.
                                        </p>
                                    </div>

                                    {/* Goal Score */}
                                    <div className="space-y-2">
                                        <Label htmlFor="goal-score">Goal Score</Label>
                                        <Input
                                            id="goal-score"
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={goalScore}
                                            onChange={(e) => {
                                                const value = parseInt(e.target.value, 10);
                                                if (!isNaN(value) && value >= 1 && value <= 20) {
                                                    setGoalScore(value);
                                                }
                                            }}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Maximum score to win (1-20)
                                        </p>
                                    </div>

                                    {createError && (
                                        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                            {createError}
                                        </div>
                                    )}
                                </>
                            )}

                            {gameMode === 'join' && (
                                <>
                                    {/* Room Code Input */}
                                    <div className="space-y-2">
                                        <Label htmlFor="join-room-code">Room Code</Label>
                                        <Input
                                            id="join-room-code"
                                            value={joinRoomCode}
                                            onChange={(e) => {
                                                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                                                setJoinRoomCode(value);
                                                setJoinError(null);
                                            }}
                                            placeholder="Enter 8-character code"
                                            className="font-mono text-lg text-center font-bold"
                                            maxLength={8}
                                            disabled={joining}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Enter the 8-character room code
                                        </p>
                                    </div>

                                    {joinError && (
                                        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                            {joinError}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    if (gameMode === 'select') {
                                        setHostGameDialogOpen(false);
                                    } else {
                                        setGameMode('select');
                                        setCreateError(null);
                                        setJoinError(null);
                                    }
                                }}
                                disabled={creating || joining}
                            >
                                {gameMode === 'select' ? 'Cancel' : 'Back'}
                            </Button>
                            {gameMode === 'host' && (
                                <Button
                                    onClick={handleCreateRoom}
                                    disabled={creating || goalScore < 1 || goalScore > 20}
                                >
                                    {creating ? 'Creating...' : 'Create Room'}
                                </Button>
                            )}
                            {gameMode === 'join' && (
                                <Button
                                    onClick={handleJoinRoom}
                                    disabled={joining || joinRoomCode.length !== 8}
                                >
                                    {joining ? 'Joining...' : 'Join Room'}
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </main>
    );
}

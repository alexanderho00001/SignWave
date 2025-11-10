'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Room } from '@/lib/types';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const BASIC_WORDS = ['HELLO', 'THANK', 'YOU', 'YES', 'NO', 'PLEASE', 'SORRY', 'HELP', 'WATER', 'FOOD'];

type ProblemType = 'alphabet' | 'number' | 'word';
type Problem = {
    type: ProblemType;
    question: string;
    answer: string | number;
};

function generateProblem(): Problem {
    const problemTypes: ProblemType[] = ['alphabet', 'number', 'word'];
    const type = problemTypes[Math.floor(Math.random() * problemTypes.length)];

    switch (type) {
        case 'alphabet':
            const letter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
            return { type: 'alphabet', question: `Sign the letter: ${letter}`, answer: letter };
        case 'number':
            const number = NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
            return { type: 'number', question: `Sign the number: ${number}`, answer: number };
        case 'word':
            const word = BASIC_WORDS[Math.floor(Math.random() * BASIC_WORDS.length)];
            return { type: 'word', question: `Sign the word: ${word}`, answer: word };
        default:
            const defaultLetter = ALPHABET[0];
            return { type: 'alphabet', question: `Sign the letter: ${defaultLetter}`, answer: defaultLetter };
    }
}

export default function ASLCompetitionPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const roomCode = searchParams.get('room') || '';

    const [room, setRoom] = useState<Room | null>(null);
    const [detectedValue, setDetectedValue] = useState<string | number | null>(null);
    const [showFeedback, setShowFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [skipDialogOpen, setSkipDialogOpen] = useState(false);
    const [giveUpDialogOpen, setGiveUpDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [justAnswered, setJustAnswered] = useState(false); // Prevent multiple answers for same problem

    const roomPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Get current user ID (you'll need to implement this based on your auth system)
    const getCurrentUserId = () => {
        // TODO: Replace with actual user ID from auth context
        return localStorage.getItem('userId') || '';
    };

    // Fetch room data
    const fetchRoom = useCallback(async () => {
        if (!roomCode) {
            setError('Room code is required');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`/api/room/${roomCode}`);
            if (!response.ok) {
                throw new Error('Failed to fetch room');
            }
            const data = await response.json();
            const roomData = data.room as Room;
            setRoom(roomData);

            // Determine if current user is host
            const userId = getCurrentUserId();
            setIsHost(roomData.host_id === userId);

            // Reset justAnswered if problem changed
            if (room && room.current_problem && roomData.current_problem) {
                const oldProblem = room.current_problem;
                const newProblem = roomData.current_problem;
                if (oldProblem.question !== newProblem.question || oldProblem.answer !== newProblem.answer) {
                    setJustAnswered(false);
                }
            }

            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load room');
            setLoading(false);
        }
    }, [roomCode]);

    // Update room in Firestore
    const updateRoom = useCallback(async (updates: Partial<Room>) => {
        if (!roomCode) return;

        try {
            const response = await fetch(`/api/room/${roomCode}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error('Failed to update room');
            }

            await fetchRoom();
        } catch (err) {
            console.error('Error updating room:', err);
        }
    }, [roomCode, fetchRoom]);

    // Generate new problem helper
    const generateNewProblem = useCallback((): Problem => {
        const problemTypes: ProblemType[] = ['alphabet', 'number', 'word'];
        const type = problemTypes[Math.floor(Math.random() * problemTypes.length)];

        switch (type) {
            case 'alphabet':
                const letter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
                return { type: 'alphabet', question: `Sign the letter: ${letter}`, answer: letter };
            case 'number':
                const number = NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
                return { type: 'number', question: `Sign the number: ${number}`, answer: number };
            case 'word':
                const word = BASIC_WORDS[Math.floor(Math.random() * BASIC_WORDS.length)];
                return { type: 'word', question: `Sign the word: ${word}`, answer: word };
            default:
                const defaultLetter = ALPHABET[0];
                return { type: 'alphabet', question: `Sign the letter: ${defaultLetter}`, answer: defaultLetter };
        }
    }, []);

    // Start game
    const startGame = useCallback(async () => {
        if (!room || !isHost) return;

        const newProblem = generateNewProblem();
        await updateRoom({
            is_started: true,
            current_problem: newProblem,
        });
    }, [room, isHost, updateRoom, generateNewProblem]);

    // Handle skip
    const handleSkip = useCallback(async () => {
        if (!room) return;

        const userId = getCurrentUserId();
        const isHostUser = room.host_id === userId;

        const newProblem = generateNewProblem();
        await updateRoom({
            [isHostUser ? 'host_skipped' : 'guest_skipped']: true,
            current_problem: newProblem,
        });

        setDetectedValue(null);
        setShowFeedback(null);
        setJustAnswered(false);
        setSkipDialogOpen(false);
    }, [room, updateRoom, generateNewProblem]);

    // Handle give up
    const handleGiveUp = useCallback(async () => {
        if (!room) return;

        const userId = getCurrentUserId();
        const isHostUser = room.host_id === userId;

        await updateRoom({
            [isHostUser ? 'host_given_up' : 'guest_given_up']: true,
            is_finished: true,
        });

        setGiveUpDialogOpen(false);
    }, [room, updateRoom]);

    // Check answer (both players can answer simultaneously)
    const checkAnswer = useCallback(async (detected: string | number) => {
        if (!room?.current_problem || justAnswered || !room.is_started || room.is_finished) return;

        const currentProblem = room.current_problem;

        if (detected === currentProblem.answer) {
            // Prevent multiple answers for the same problem
            setJustAnswered(true);
            setShowFeedback('correct');
            
            const userId = getCurrentUserId();
            const isHostUser = room.host_id === userId;

            // Update score
            const newHostScore = isHostUser ? room.host_score + 1 : room.host_score;
            const newGuestScore = isHostUser ? room.guest_score : room.guest_score + 1;

            // Check if game should end (someone reached goal score)
            const gameFinished = newHostScore >= room.goal_score || newGuestScore >= room.goal_score;

            // Generate new problem if game not finished
            const newProblem = gameFinished ? undefined : generateNewProblem();

            // Update room with score, new problem, and who solved it
            await updateRoom({
                [isHostUser ? 'host_score' : 'guest_score']: isHostUser ? newHostScore : newGuestScore,
                is_finished: gameFinished,
                current_problem: newProblem,
                last_solved_by: userId,
            });

            setTimeout(() => {
                setShowFeedback(null);
                setDetectedValue(null);
                // Reset justAnswered will happen when new problem is fetched
            }, 1500);
        } else {
            setShowFeedback('incorrect');
            setTimeout(() => {
                setShowFeedback(null);
            }, 1000);
        }
    }, [room, justAnswered, updateRoom, generateNewProblem]);

    // Start webcam for current user
    useEffect(() => {
        const startWebcam = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480 },
                });
                
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error('Error accessing webcam:', err);
            }
        };

        startWebcam();

        return () => {
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Backend hand detection function
    const detectHandSign = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !room?.current_problem || !room.is_started || room.is_finished || justAnswered) {
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        try {
            const response = await fetch('http://localhost:8000/api/track-hands/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageData }),
            });

            if (!response.ok) return;

            const data = await response.json();
            console.log('Detection response:', data);
            const currentProblem = room.current_problem;
            if (!currentProblem) return;

            // Process detection based on problem type
            // Check for different response formats from backend
            if (currentProblem.type === 'alphabet') {
                let detectedLetter: string | null = null;
                
                // Try different response formats
                if (data.detected_letter) {
                    detectedLetter = data.detected_letter;
                } else if (data.letters && Array.isArray(data.letters) && data.letters.length > 0) {
                    detectedLetter = data.letters[0];
                }
                
                if (detectedLetter) {
                    setDetectedValue(detectedLetter);
                    checkAnswer(detectedLetter);
                }
            } else if (currentProblem.type === 'number') {
                let detectedNumber: number | null = null;
                
                if (data.detected_number) {
                    detectedNumber = data.detected_number;
                } else if (data.numbers && Array.isArray(data.numbers) && data.numbers.length > 0) {
                    detectedNumber = data.numbers[0];
                }
                
                if (detectedNumber !== null) {
                    setDetectedValue(detectedNumber);
                    checkAnswer(detectedNumber);
                }
            } else if (currentProblem.type === 'word') {
                let detectedWord: string | null = null;
                
                if (data.detected_word) {
                    detectedWord = data.detected_word;
                } else if (data.predicted_sign) {
                    detectedWord = data.predicted_sign;
                } else if (data.words && Array.isArray(data.words) && data.words.length > 0) {
                    detectedWord = data.words[0];
                }
                
                if (detectedWord) {
                    setDetectedValue(detectedWord);
                    checkAnswer(detectedWord);
                }
            }
        } catch (error) {
            console.error('Error detecting hand sign:', error);
        }
    }, [room, justAnswered, checkAnswer]);

    // Hand detection when game is active
    useEffect(() => {
        if (!room?.current_problem || !room.is_started || room.is_finished || justAnswered) {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            return;
        }

        // Start detecting hand signs every 500ms
        detectionIntervalRef.current = setInterval(detectHandSign, 500);

        return () => {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
        };
    }, [room, justAnswered, detectHandSign]);

    // Poll room for updates
    useEffect(() => {
        fetchRoom();

        roomPollIntervalRef.current = setInterval(() => {
            fetchRoom();
        }, 2000); // Poll every 2 seconds

        return () => {
            if (roomPollIntervalRef.current) {
                clearInterval(roomPollIntervalRef.current);
            }
        };
    }, [fetchRoom]);

    // Get room status text
    const getRoomStatus = () => {
        if (!room) return 'Loading...';
        if (room.is_finished) return 'Game Finished';
        if (!room.is_started) {
            if (!room.guest_id) return 'Waiting for opponent...';
            return 'Ready to start';
        }
        return `First to ${room.goal_score} wins!`;
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Card className="w-full max-w-2xl">
                    <CardContent className="p-6">
                        <p className="text-center">Loading room...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !room) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Card className="w-full max-w-2xl">
                    <CardContent className="p-6">
                        <p className="text-center text-destructive">{error || 'Room not found'}</p>
                        <Button onClick={() => router.push('/dashboard')} className="mt-4 w-full">
                            Back to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Room Info and Scores */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">Room: {room.room_code}</CardTitle>
                            <CardDescription className="mt-1">{getRoomStatus()}</CardDescription>
                        </div>
                        {room.is_started && (
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">Goal</p>
                                <p className="text-xl font-bold">{room.goal_score}</p>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {!room.is_started && isHost && room.guest_id ? (
                        <Button onClick={startGame} className="w-full">
                            Start Game
                        </Button>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 border rounded-lg bg-muted/50">
                                <p className="text-sm text-muted-foreground mb-1">Host</p>
                                <p className="text-xl font-semibold">{room.host_name}</p>
                                <p className="text-4xl font-bold mt-2 text-primary">{room.host_score}</p>
                            </div>
                            <div className="text-center p-4 border rounded-lg bg-muted/50">
                                <p className="text-sm text-muted-foreground mb-1">Guest</p>
                                <p className="text-xl font-semibold">{room.guest_name || 'Waiting...'}</p>
                                <p className="text-4xl font-bold mt-2 text-primary">{room.guest_score}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Problem and Camera - Side by Side */}
            {room.is_started && !room.is_finished && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Current Problem */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Current Problem</CardTitle>
                            <CardDescription>
                                First to {room.goal_score} points wins
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {room.current_problem ? (
                                <div className="text-center py-8">
                                    <p className="text-3xl font-bold mb-4">{room.current_problem.question}</p>
                                    {room.last_solved_by && room.last_solved_by === getCurrentUserId() && (
                                        <p className="text-green-500 text-lg mb-2">✓ You solved it!</p>
                                    )}
                                    {room.last_solved_by && room.last_solved_by !== getCurrentUserId() && (
                                        <p className="text-orange-500 text-lg mb-2">⚡ Opponent solved it first!</p>
                                    )}
                                    {showFeedback === 'correct' && (
                                        <p className="text-green-500 text-xl">✓ Correct!</p>
                                    )}
                                    {showFeedback === 'incorrect' && (
                                        <p className="text-red-500 text-xl">✗ Incorrect</p>
                                    )}
                                    {detectedValue && (
                                        <p className="text-muted-foreground mt-2">
                                            Detected: {detectedValue}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">Waiting for game to start...</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Camera */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Hand Tracker</CardTitle>
                            <CardDescription>
                                Show your hand to the camera to sign the answer. First to answer correctly wins the point!
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                                <canvas
                                    ref={canvasRef}
                                    className="hidden"
                                />

                                {/* Detection overlay */}
                                {room.is_started && !room.is_finished && detectedValue && (
                                    <div className={`absolute top-4 left-4 px-4 py-2 rounded-lg shadow-lg ${
                                        showFeedback === 'correct' 
                                            ? 'bg-green-500' 
                                            : showFeedback === 'incorrect'
                                                ? 'bg-red-500'
                                                : 'bg-orange-500'
                                    } text-white`}>
                                        <div className="text-lg font-bold">
                                            {showFeedback === 'correct' 
                                                ? '✅ Correct!' 
                                                : showFeedback === 'incorrect'
                                                    ? `✗ ${detectedValue}`
                                                    : `Detected: ${detectedValue}`}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Action Buttons */}
            {room.is_started && !room.is_finished && (
                <div className="flex gap-4">
                    <Button
                        variant="outline"
                        onClick={() => setSkipDialogOpen(true)}
                        className="flex-1"
                        disabled={room.is_finished}
                    >
                        Skip This Problem
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => setGiveUpDialogOpen(true)}
                        className="flex-1"
                        disabled={room.is_finished}
                    >
                        Give Up Game
                    </Button>
                </div>
            )}

            {/* Game Finished */}
            {room.is_finished && (
                <Card>
                    <CardHeader>
                        <CardTitle>Game Finished</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-4">
                            <p className="text-2xl mb-4">
                                {room.host_score > room.guest_score
                                    ? `${room.host_name} Wins!`
                                    : room.guest_score > room.host_score
                                    ? `${room.guest_name} Wins!`
                                    : "It's a Tie!"}
                            </p>
                            <Button onClick={() => router.push('/dashboard')} className="mt-4">
                                Back to Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Skip Confirmation Dialog */}
            <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Skip This Problem?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to skip this problem? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleSkip}>
                            Yes, Skip
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Give Up Confirmation Dialog */}
            <Dialog open={giveUpDialogOpen} onOpenChange={setGiveUpDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Give Up Game?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to give up? This will end the game and you will lose.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGiveUpDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleGiveUp}>
                            Yes, Give Up
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


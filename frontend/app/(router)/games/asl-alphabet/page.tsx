'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const FALL_SPEED = 0.5; // pixels per frame
const SPAWN_INTERVAL = 3000; // milliseconds
const GAME_AREA_HEIGHT = 600; // pixels

type FallingLetter = {
    id: string;
    letter: string;
    x: number;
    y: number;
    speed: number;
};

export default function ASLAlphabetGame() {
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
    const [fallingLetters, setFallingLetters] = useState<FallingLetter[]>([]);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [detectedLetter, setDetectedLetter] = useState<string | null>(null);
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastSpawnTimeRef = useRef<number>(0);
    const gameStartTimeRef = useRef<number>(0);

    // Backend communication refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Generate random letter
    const getRandomLetter = useCallback(() => {
        return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }, []);

    // Spawn a new falling letter
    const spawnLetter = useCallback(() => {
        if (!gameAreaRef.current) return;

        const gameAreaWidth = gameAreaRef.current.clientWidth;
        const letterWidth = 60; // Approximate width of letter
        const maxX = gameAreaWidth - letterWidth;
        const x = Math.random() * maxX;

        const newLetter: FallingLetter = {
            id: `${Date.now()}-${Math.random()}`,
            letter: getRandomLetter(),
            x,
            y: 0,
            speed: FALL_SPEED + Math.random() * 1, // Slight variation in speed
        };

        setFallingLetters((prev) => [...prev, newLetter]);
    }, [getRandomLetter]);

    // Update falling letters position
    const updateLetters = useCallback(() => {
        setFallingLetters((prev) => {
            const updated = prev.map((letter) => ({
                ...letter,
                y: letter.y + letter.speed,
            }));

            // Check if any letter hit the bottom
            const hitBottom = updated.some((letter) => letter.y >= GAME_AREA_HEIGHT);
            if (hitBottom) {
                // Remove letters that hit bottom and decrease lives
                const remaining = updated.filter((letter) => letter.y < GAME_AREA_HEIGHT);
                setLives((prevLives) => {
                    const newLives = prevLives - 1;
                    if (newLives <= 0) {
                        setGameState('gameover');
                    }
                    return newLives;
                });
                return remaining;
            }

            return updated;
        });
    }, []);

    // Check for matches between detected letter and falling letters
    const checkMatches = useCallback((detected: string) => {
        setFallingLetters((prev) => {
            const matched = prev.find((letter) => letter.letter === detected);
            if (matched) {
                setScore((prevScore) => prevScore + 10);
                // Show feedback
                setDetectedLetter(detected);
                setTimeout(() => setDetectedLetter(null), 500);
                return prev.filter((letter) => letter.id !== matched.id);
            }
            return prev;
        });
    }, []);

    // Backend hand detection function
    const detectHandSign = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || gameState !== 'playing') {
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

            const data = await response.json();

            if (data.letters && data.letters.length > 0) {
                const letter = data.letters[0];
                checkMatches(letter);
            }
        } catch (error) {
            console.error('Error detecting hand sign:', error);
        }
    }, [gameState, checkMatches]);

    // Start webcam
    const startWebcam = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
        }
    }, []);

    // Initialize webcam on mount
    useEffect(() => {
        startWebcam();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [startWebcam]);

    // Game loop
    useEffect(() => {
        if (gameState !== 'playing') {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            return;
        }

        const gameLoop = () => {
            const now = Date.now();

            // Spawn new letters at intervals
            if (now - lastSpawnTimeRef.current >= SPAWN_INTERVAL) {
                spawnLetter();
                lastSpawnTimeRef.current = now;
            }

            // Update falling letters
            updateLetters();

            animationFrameRef.current = requestAnimationFrame(gameLoop);
        };

        gameStartTimeRef.current = Date.now();
        lastSpawnTimeRef.current = Date.now();
        animationFrameRef.current = requestAnimationFrame(gameLoop);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [gameState, spawnLetter, updateLetters]);

    // Backend hand detection when game is playing
    useEffect(() => {
        if (gameState !== 'playing') {
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
    }, [gameState, detectHandSign]);

    const startGame = () => {
        setGameState('playing');
        setFallingLetters([]);
        setScore(0);
        setLives(3);
        setDetectedLetter(null);
    };

    const pauseGame = () => {
        setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
    };

    const resetGame = () => {
        setGameState('menu');
        setFallingLetters([]);
        setScore(0);
        setLives(3);
        setDetectedLetter(null);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">ASL Alphabet Game</h1>
                <p className="text-muted-foreground">
                    Sign the falling letters before they hit the bottom!
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Game Area */}
                <div className="w-full">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-2xl font-semibold">Game</CardTitle>
                                    <CardDescription>Sign the falling letters</CardDescription>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">Score</div>
                                        <div className="text-2xl font-bold">{score}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">Lives</div>
                                        <div className="text-2xl font-bold text-red-500">{lives}</div>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {gameState === 'menu' && (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <p className="text-lg text-muted-foreground mb-4">
                                        Sign letters as they fall to earn points!
                                    </p>
                                    <Button onClick={startGame} size="lg">
                                        Start Game
                                    </Button>
                                </div>
                            )}

                            {gameState === 'gameover' && (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <h2 className="text-3xl font-bold text-red-500">Game Over!</h2>
                                    <p className="text-xl">Final Score: {score}</p>
                                    <div className="flex gap-4">
                                        <Button onClick={resetGame} variant="outline">
                                            Main Menu
                                        </Button>
                                        <Button onClick={startGame}>Play Again</Button>
                                    </div>
                                </div>
                            )}

                            {(gameState === 'playing' || gameState === 'paused') && (
                                <>
                                    {gameState === 'paused' && (
                                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
                                            <div className="text-center">
                                                <h3 className="text-2xl font-bold mb-4">Paused</h3>
                                                <Button onClick={pauseGame}>Resume</Button>
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        ref={gameAreaRef}
                                        className="relative bg-gradient-to-b from-background to-muted/20 rounded-lg border-2 border-primary/20 overflow-hidden"
                                        style={{ height: `${GAME_AREA_HEIGHT}px` }}>
                                        {/* Falling Letters */}
                                        {fallingLetters.map((letter) => (
                                            <div
                                                key={letter.id}
                                                className="absolute transition-none"
                                                style={{
                                                    left: `${letter.x}px`,
                                                    top: `${letter.y}px`,
                                                    transform: 'translateY(0)',
                                                }}>
                                                <div className="w-14 h-14 rounded-lg bg-primary/20 border-2 border-primary/40 flex items-center justify-center shadow-lg backdrop-blur-sm">
                                                    <span className="text-3xl font-bold text-primary">
                                                        {letter.letter}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Detection Feedback */}
                                        {detectedLetter && (
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 animate-pulse">
                                                <div className="text-6xl font-bold text-green-500 drop-shadow-lg">
                                                    {detectedLetter} ✓
                                                </div>
                                            </div>
                                        )}

                                        {/* Bottom line indicator */}
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/50" />
                                    </div>
                                    <div className="mt-4 flex justify-center gap-2">
                                        <Button onClick={pauseGame} variant="outline" size="sm">
                                            {gameState === 'paused' ? 'Resume' : 'Pause'}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Hand Tracker */}
                <div className="w-full flex flex-col">
                    <Card className="h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-2xl font-semibold">Hand Tracker</CardTitle>
                            <CardDescription>
                                {gameState === 'playing'
                                    ? 'Sign the letters as they fall!'
                                    : 'Start the game to begin tracking'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                                <canvas ref={canvasRef} className="hidden" />
                                {gameState !== 'playing' && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                        <p className="text-white text-sm">Start the game to begin tracking</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Instructions */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="mt-6 w-full">
                                How to Play
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>How to Play</DialogTitle>
                                <DialogDescription>
                                    Learn how to play the ASL Alphabet Game
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                                    <li>Sign the letters as they fall from the top</li>
                                    <li>Match the sign before the letter hits the bottom</li>
                                    <li>Earn 10 points for each correct match</li>
                                    <li>Lose a life if a letter reaches the bottom</li>
                                    <li>Game ends when you run out of lives</li>
                                </ul>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    );
}


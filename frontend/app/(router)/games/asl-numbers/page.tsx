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
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

const TOTAL_ROUNDS = 5;
const TIME_PER_ROUND = 30; // seconds

type Problem = {
    question: string;
    answer: number;
};

// Generate basic arithmetic problems with answers 0-9
const generateProblem = (): Problem => {
    const answer = Math.floor(Math.random() * 10); // Random answer between 0-9

    // Generate different types of arithmetic problems
    const problemTypes: Problem[] = [];

    // Addition: a + b = answer
    if (answer > 1) {
        const addend1 = Math.floor(Math.random() * (answer - 1)) + 1;
        const addend2 = answer - addend1;
        problemTypes.push({
            question: `${addend1} + ${addend2}`,
            answer: answer,
        });
    } else {
        // For answer = 1, use 0 + 1 or 1 + 0
        problemTypes.push({
            question: `0 + ${answer}`,
            answer: answer,
        });
    }

    // Subtraction: a - b = answer (where a = answer + b)
    const subtrahend = Math.floor(Math.random() * 10) + 1;
    const minuend = answer + subtrahend;
    problemTypes.push({
        question: `${minuend} - ${subtrahend}`,
        answer: answer,
    });

    // Multiplication: a * b = answer
    // Find factors of answer
    const factors: number[][] = [];
    for (let i = 1; i <= answer; i++) {
        if (answer % i === 0) {
            factors.push([i, answer / i]);
        }
    }
    if (factors.length > 0) {
        const [factor1, factor2] = factors[Math.floor(Math.random() * factors.length)];
        problemTypes.push({
            question: `${factor1} \\times ${factor2}`,
            answer: answer,
        });
    }

    // Division: a / b = answer (where a = answer * b)
    const divisor = Math.floor(Math.random() * 5) + 1; // divisor between 1-5
    const dividend = answer * divisor;
    problemTypes.push({
        question: `${dividend} \\div ${divisor}`,
        answer: answer,
    });

    return problemTypes[Math.floor(Math.random() * problemTypes.length)];
};

export default function ASLNumbersGame() {
    const router = useRouter();
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'paused' | 'gameover'>('menu');
    const [currentRound, setCurrentRound] = useState(1);
    const [currentProblem, setCurrentProblem] = useState<Problem | null>(null);
    const [score, setScore] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(TIME_PER_ROUND);
    const [detectedNumber, setDetectedNumber] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [currentPrediction, setCurrentPrediction] = useState<number | null>(null);
    const [justAnswered, setJustAnswered] = useState(false); // Prevent multiple answers for same problem
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const gameAreaRef = useRef<HTMLDivElement>(null);
    
    // Backend communication refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Start a new round
    const startRound = useCallback(() => {
        const problem = generateProblem();
        setCurrentProblem(problem);
        setTimeRemaining(TIME_PER_ROUND);
        setDetectedNumber(null);
        setShowFeedback(null);
        setJustAnswered(false); // Reset answer lock for new problem
        setCurrentPrediction(null);
    }, []);

    // Check if detected number matches the answer
    const checkAnswer = useCallback(
        (detected: number) => {
            if (!currentProblem || gameState !== 'playing' || justAnswered) return;

            if (detected === currentProblem.answer) {
                // Prevent multiple answers for the same problem
                setJustAnswered(true);
                setScore((prev) => prev + 10);
                setShowFeedback('correct');
                setTimeout(() => {
                    setShowFeedback(null);
                    // Move to next round
                    if (currentRound < TOTAL_ROUNDS) {
                        setCurrentRound((prev) => prev + 1);
                        startRound();
                    } else {
                        // Game complete
                        setGameState('gameover');
                    }
                }, 1500);
            } else {
                setShowFeedback('incorrect');
                setTimeout(() => setShowFeedback(null), 1000);
            }
        },
        [currentProblem, currentRound, gameState, startRound, justAnswered]
    );

    // Timer countdown
    useEffect(() => {
        if (gameState !== 'playing' || timeRemaining <= 0) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        timerRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    // Time's up - move to next round or end game
                    if (currentRound < TOTAL_ROUNDS) {
                        setCurrentRound((prev) => prev + 1);
                        startRound();
                        return TIME_PER_ROUND;
                    } else {
                        setGameState('gameover');
                        return 0;
                    }
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [gameState, timeRemaining, currentRound, startRound]);

    // Backend hand detection function
    const detectHandSign = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || gameState !== 'playing' || !currentProblem || justAnswered) {
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
            const response = await fetch('http://localhost:8000/api/track-numbers/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageData }),
            });

            if (!response.ok) {
                console.error('API response not OK:', response.status, response.statusText);
                return;
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Response is not JSON:', contentType);
                return;
            }

            const data = await response.json();
            console.log('Number detection response:', data);

            // track-numbers returns {hands: [...], letters: [...]} (numbers as strings in letters array)
            if (data.letters && Array.isArray(data.letters) && data.letters.length > 0) {
                const detectedNumberStr = data.letters[0];
                const detectedNumber = parseInt(detectedNumberStr, 10);
                if (!isNaN(detectedNumber)) {
                    setCurrentPrediction(detectedNumber);
                    setDetectedNumber(detectedNumber);
                    checkAnswer(detectedNumber);
                }
            }
        } catch (error) {
            console.error('Error detecting hand sign:', error);
        }
    }, [gameState, currentProblem, checkAnswer, justAnswered]);

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
        setCurrentRound(1);
        setScore(0);
        setTimeRemaining(TIME_PER_ROUND);
        setDetectedNumber(null);
        setShowFeedback(null);
        setCurrentPrediction(null);
        setJustAnswered(false);
        startRound();
    };

    const pauseGame = () => {
        setGameState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
    };

    const resetGame = () => {
        setGameState('menu');
        setCurrentRound(1);
        setScore(0);
        setTimeRemaining(TIME_PER_ROUND);
        setDetectedNumber(null);
        setShowFeedback(null);
        setCurrentPrediction(null);
        setJustAnswered(false);
        setCurrentProblem(null);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/dashboard')}
                    className="mb-4"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Button>
                <h1 className="text-3xl font-bold mb-2">ASL Numbers Game</h1>
                <p className="text-muted-foreground">Solve arithmetic problems by signing the answer!</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Game Area */}
                <div className="w-full">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-2xl font-semibold">Game</CardTitle>
                                    <CardDescription>Solve the math problem</CardDescription>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">Score</div>
                                        <div className="text-2xl font-bold">{score}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">Round</div>
                                        <div className="text-2xl font-bold">
                                            {currentRound}/{TOTAL_ROUNDS}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-muted-foreground">Time</div>
                                        <div
                                            className={`text-2xl font-bold ${
                                                timeRemaining <= 10 ? 'text-red-500' : ''
                                            }`}>
                                            {timeRemaining}s
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {gameState === 'menu' && (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <p className="text-lg text-muted-foreground mb-4">
                                        Solve {TOTAL_ROUNDS} arithmetic problems in {TIME_PER_ROUND} seconds each!
                                    </p>
                                    <Button onClick={startGame} size="lg">
                                        Start Game
                                    </Button>
                                </div>
                            )}

                            {gameState === 'gameover' && (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <h2 className="text-3xl font-bold text-green-500">Game Complete!</h2>
                                    <p className="text-xl">Final Score: {score}</p>
                                    <p className="text-muted-foreground">You completed {TOTAL_ROUNDS} rounds!</p>
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
                                        className="relative from-background to-muted/20 rounded-lg border-2 border-primary/20 overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-8">
                                        {/* Problem Display */}
                                        {currentProblem && (
                                            <div className="text-center space-y-6">
                                                <div className="text-sm text-muted-foreground">
                                                    Round {currentRound} of {TOTAL_ROUNDS}
                                                </div>
                                                <div className="text-5xl font-bold text-primary mb-4 flex items-center justify-center">
                                                    <InlineMath math={currentProblem.question} />
                                                </div>
                                                <div className="text-lg text-muted-foreground">
                                                    Sign your answer (1-10)
                                                </div>
                                            </div>
                                        )}

                                        {/* Detection Feedback */}
                                        {detectedNumber !== null && (
                                            <div className="mt-6 text-center">
                                                <div className="text-2xl font-semibold text-muted-foreground">
                                                    Detected: {detectedNumber}
                                                </div>
                                            </div>
                                        )}

                                        {/* Correct/Incorrect Feedback */}
                                        {showFeedback && (
                                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 animate-pulse">
                                                <div
                                                    className={`text-6xl font-bold drop-shadow-lg ${
                                                        showFeedback === 'correct' ? 'text-green-500' : 'text-red-500'
                                                    }`}>
                                                    {showFeedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}
                                                </div>
                                            </div>
                                        )}
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
                                    ? 'Sign the answer to the math problem!'
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
                                
                                {/* Detection overlay - Prediction display */}
                                {gameState === 'playing' && currentPrediction !== null && (
                                    <div className="absolute top-4 left-4 px-4 py-2 rounded-lg shadow-lg bg-orange-500 text-white">
                                        <div className="text-lg font-bold">
                                            Detected: {currentPrediction}
                                        </div>
                                    </div>
                                )}

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
                                <DialogDescription>Learn how to play the ASL Numbers Game</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                                    <li>Solve {TOTAL_ROUNDS} arithmetic problems (+, -, ×, ÷)</li>
                                    <li>You have {TIME_PER_ROUND} seconds per round</li>
                                    <li>Sign the answer using ASL numbers (1-10)</li>
                                    <li>Earn 10 points for each correct answer</li>
                                    <li>Complete all rounds to finish the game</li>
                                </ul>
                                <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-xs text-muted-foreground">
                                        <strong>Note:</strong> Hand detection is currently simulated for demo purposes.
                                        Backend integration coming soon!
                                    </p>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    );
}

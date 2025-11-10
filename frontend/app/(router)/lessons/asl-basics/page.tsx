'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WORDS } from '@/lib/data/words';
import { ASLVisualization } from '@/components/ASLVisualization';

const REQUIRED_HOLD_DURATION = 500; // ms (kept but not used for completion now)

const getRandomWord = () => {
    const randomIndex = Math.floor(Math.random() * WORDS.length);
    return WORDS[randomIndex];
};

export default function ASLBasicWordsPage() {
    const [currentWord, setCurrentWord] = useState<string>('');
    const [detectedWord, setDetectedWord] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [displayedWord, setDisplayedWord] = useState<string | null>(null);
    const [framesLeft, setFramesLeft] = useState(0);
    const [countdown, setCountdown] = useState(3); // 🔢 3 → 2 → 1 indicator
    const [showVisualization, setShowVisualization] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const firstCorrectDetectionTimeRef = useRef<number | null>(null);
    const justCompletedRef = useRef(false);
    const framesSinceResetRef = useRef(0); // how many frames we've sent for current word

    // Clear the displayed word when the frame counter hits 0
    useEffect(() => {
        if (framesLeft <= 0) {
            // Use setTimeout to make setState asynchronous
            const timer = setTimeout(() => {
                setDisplayedWord(null);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [framesLeft]);

    // Set initial random word on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentWord(getRandomWord());
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    // Start webcam
    const startWebcam = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' },
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error('Error accessing webcam:', err);
        }
    }, []);

    // Initialize webcam on mount + clean up
    useEffect(() => {
        startWebcam();
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [startWebcam]);

    const generateRandomWord = useCallback(() => {
        const randomIndex = Math.floor(Math.random() * WORDS.length);
        setCurrentWord(WORDS[randomIndex]);
        setDetectedWord(null);
        setIsCorrect(null);
        justCompletedRef.current = false;
        firstCorrectDetectionTimeRef.current = null;
        setDisplayedWord(null);
        setFramesLeft(0);
        framesSinceResetRef.current = 0;
        setCountdown(3); // reset countdown for new word
    }, []);

    // Call backend once, return whether we reached confidence threshold & success
    const detectHandSign = useCallback(async () => {
        if (
            !videoRef.current ||
            !canvasRef.current ||
            !isTracking ||
            !currentWord ||
            justCompletedRef.current
        ) {
            return { confident: false };
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { confident: false };

        if (video.readyState !== video.HAVE_ENOUGH_DATA) return { confident: false };

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);

        try {
            const res = await fetch('http://localhost:8000/api/track-video/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageData }),
            });

            const data = await res.json();

            const sign = data.predicted_sign; // backend word
            const confidence = data.confidence ?? 0;
            const threshold = 30; // %

            // Nothing confident enough yet
            if (!sign || confidence < threshold) {
                setDetectedWord(null);
                if (!justCompletedRef.current) {
                    setIsCorrect(null);
                }

                // Keep showing last detected word for a bit
                setFramesLeft((prev) => (prev > 0 ? prev - 1 : 0));

                // 🔢 Update approximate "3,2,1" countdown based on ~30-frame window
                const maxFrames = 30;

                // cycle frames 1..30 repeatedly so countdown loops 3→2→1
                framesSinceResetRef.current = (framesSinceResetRef.current % maxFrames) + 1;

                const frames = framesSinceResetRef.current;
                const segment = maxFrames / 3; // 10 frames per step

                let step = 3 - Math.floor((frames - 1) / segment);
                if (step < 1) step = 1;

                setCountdown(step);

                firstCorrectDetectionTimeRef.current = null;
                return { confident: false };
            }

            // We have a confident prediction from backend
            setDetectedWord(sign);
            setDisplayedWord(sign);
            setFramesLeft(30); // holds overlay text for a bit
            framesSinceResetRef.current = 0;
            setCountdown(3);

            const correct =
                sign.toLowerCase().trim() === currentWord.toLowerCase().trim();

            if (!correct) {
                setIsCorrect(false);
                firstCorrectDetectionTimeRef.current = null;
                // for wrong-but-confident, we don't care about countdown anymore
                return { confident: false };
            }

            // ✅ Correct sign detected (no extra hold needed to complete)
            if (!justCompletedRef.current) {
                justCompletedRef.current = true;
                setIsCorrect(true);

                // Move to next word after a brief pause so user sees green state
                setTimeout(() => {
                    generateRandomWord();
                    setIsCorrect(null);
                    setDetectedWord(null);
                    setDisplayedWord(null);
                    setFramesLeft(0);
                    justCompletedRef.current = false;
                    firstCorrectDetectionTimeRef.current = null;
                    framesSinceResetRef.current = 0;
                    setCountdown(3);
                }, 1000);
            }

            return { confident: true };
        } catch (err) {
            console.error('detectHandSign failed:', err);
            return { confident: false };
        }
    }, [isTracking, currentWord, generateRandomWord]);

    // 🔁 Async loop instead of setInterval – feels instant
    useEffect(() => {
        let stop = false;

        const loop = async () => {
            if (stop || !isTracking) return;

            const result = await detectHandSign();

            // If not confidently recognized yet → poll again soon
            if (!result?.confident) {
                setTimeout(loop, 100); // 100ms feels snappy
            } else {
                // If confident & completed, give user a moment before next loop
                setTimeout(loop, 500);
            }
        };

        if (isTracking) {
            loop();
        }

        return () => {
            stop = true;
        };
    }, [isTracking, detectHandSign]);

    // When tracking stops, clear the UI state
    useEffect(() => {
        if (!isTracking) {
            const timer = setTimeout(() => {
                setDetectedWord(null);
                setIsCorrect(null);
                firstCorrectDetectionTimeRef.current = null;
                justCompletedRef.current = false;
                setDisplayedWord(null);
                setFramesLeft(0);
                framesSinceResetRef.current = 0;
                setCountdown(3);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isTracking]);

    const toggleTracking = () => {
        setIsTracking((prev) => !prev);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">ASL Basic Words Practice</h1>
                <p className="text-muted-foreground">
                    Practice signing basic ASL words. Try to match the word shown below!
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="w-full">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl font-semibold">Hand Tracker</CardTitle>
                            <CardDescription>
                                {isTracking
                                    ? 'Sign the word shown on the right!'
                                    : 'Click "Start Tracking" to begin'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                                <canvas ref={canvasRef} className="hidden" />

                                {/* Status / detection overlay */}
                                {isTracking && (
                                    <div
                                        className={`absolute top-4 left-4 px-4 py-2 rounded-lg shadow-lg ${isCorrect
                                            ? 'bg-green-500'
                                            : displayedWord
                                                ? 'bg-orange-500'
                                                : 'bg-black/60'
                                            } text-white`}
                                    >
                                        <div className="text-lg font-bold">
                                            {isCorrect
                                                ? '✅ Correct!'
                                                : displayedWord
                                                    ? `Detected: ${displayedWord}`
                                                    : `Detecting sign... ${countdown}`}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={toggleTracking}
                                variant={isTracking ? 'destructive' : 'default'}
                                size="lg"
                                className="w-full"
                            >
                                {isTracking ? '⏹ Stop Tracking' : '▶ Start Tracking'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="w-full flex flex-col">
                    <Card className="h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-2xl font-semibold">Sign This Word</CardTitle>
                            <CardDescription>
                                Use your webcam to sign the word shown below
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
                            {!currentWord ? (
                                <div className="text-muted-foreground">Loading...</div>
                            ) : (
                                <>
                                    <div className="w-full flex items-center justify-center">
                                        <div className="relative">
                                            <div className="min-w-64 min-h-64 px-8 py-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-4 border-primary/30 flex items-center justify-center shadow-lg">
                                                <span className="text-6xl md:text-7xl font-bold text-primary select-none tracking-wide">
                                                    {currentWord}
                                                </span>
                                            </div>
                                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary/20 rounded-full animate-pulse" />
                                            <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-primary/20 rounded-full animate-pulse delay-300" />
                                        </div>
                                    </div>

                                    <div className="text-center space-y-2">
                                        <p className="text-lg font-medium">
                                            Practice signing the word{' '}
                                            <span className="text-primary font-bold">
                                                {currentWord}
                                            </span>
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {isTracking
                                                ? 'Sign the word and let the model detect it'
                                                : 'Click "Start Tracking" and position your hand in front of the camera'}
                                        </p>
                                        {isCorrect && (
                                            <div className="mt-4 text-2xl font-bold text-green-500 animate-pulse">
                                                ✓ Great job! Moving to next word...
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <Button
                                    onClick={generateRandomWord}
                                    variant="outline"
                                    size="lg"
                                    className="flex-1"
                                >
                                    Get New Word
                                </Button>
                                <Button
                                    onClick={() => setShowVisualization(true)}
                                    variant="secondary"
                                    size="lg"
                                    className="flex-1"
                                    disabled={!currentWord}
                                >
                                    Show Me How to Sign &quot;{currentWord}&quot;
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle className="text-lg">Tips</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                                <li>Make sure your hand is fully visible in the camera</li>
                                <li>Use good lighting for better hand tracking</li>
                                <li>Keep your hand steady while signing</li>
                                <li>Click &quot;Get New Word&quot; to practice a different word</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Visualization Modal */}
            {showVisualization && currentWord && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold">
                                    How to Sign: {currentWord}
                                </h2>
                                <Button
                                    onClick={() => setShowVisualization(false)}
                                    variant="ghost"
                                    size="sm"
                                >
                                    ✕ Close
                                </Button>
                            </div>
                            <ASLVisualization
                                signName={currentWord}
                                signType="words"
                                autoPlay={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

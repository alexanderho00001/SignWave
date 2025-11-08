'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const REQUIRED_HOLD_DURATION = 500; // milliseconds

// Generate a random letter
const getRandomLetter = () => {
    const randomIndex = Math.floor(Math.random() * ALPHABET.length);
    return ALPHABET[randomIndex];
};

export default function ASLAlphabetPage() {
    // Always initialize with empty string to ensure server and client render the same
    const [currentLetter, setCurrentLetter] = useState<string>('');
    const [detectedLetter, setDetectedLetter] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    
    // Backend communication refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const firstCorrectDetectionTimeRef = useRef<number | null>(null);
    const justCompletedRef = useRef(false);

    // Set random letter after mount using async update to avoid synchronous setState warning
    useEffect(() => {
        // Use setTimeout to make the state update asynchronous
        // This avoids the synchronous setState warning while ensuring hydration safety
        const timer = setTimeout(() => {
            setCurrentLetter(getRandomLetter());
        }, 0);

        return () => clearTimeout(timer);
    }, []);

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

    const generateRandomLetter = useCallback(() => {
        const randomIndex = Math.floor(Math.random() * ALPHABET.length);
        setCurrentLetter(ALPHABET[randomIndex]);
        setDetectedLetter(null);
        setIsCorrect(null);
        justCompletedRef.current = false;
        firstCorrectDetectionTimeRef.current = null;
    }, []);

    // Backend hand detection function
    const detectHandSign = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || !isTracking || !currentLetter || justCompletedRef.current) {
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
                setDetectedLetter(letter);
                
                const correct = letter === currentLetter;
                
                if (correct) {
                    setIsCorrect(true);
                    
                    if (firstCorrectDetectionTimeRef.current === null) {
                        firstCorrectDetectionTimeRef.current = Date.now();
                    } else {
                        const durationHeld = Date.now() - firstCorrectDetectionTimeRef.current;
                        
                        if (durationHeld >= REQUIRED_HOLD_DURATION && !justCompletedRef.current) {
                            justCompletedRef.current = true;
                            
                            // Auto-advance to next letter after success
                            setTimeout(() => {
                                generateRandomLetter();
                                setIsCorrect(null);
                                setDetectedLetter(null);
                                justCompletedRef.current = false;
                                firstCorrectDetectionTimeRef.current = null;
                            }, 1500);
                        }
                    }
                } else {
                    setIsCorrect(false);
                    firstCorrectDetectionTimeRef.current = null;
                }
            } else {
                setDetectedLetter(null);
                firstCorrectDetectionTimeRef.current = null;
                if (!justCompletedRef.current) {
                    setIsCorrect(null);
                }
            }
        } catch (error) {
            console.error('Error detecting hand sign:', error);
        }
    }, [isTracking, currentLetter, generateRandomLetter]);

    // Backend hand detection when tracking is active
    useEffect(() => {
        if (!isTracking) {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            // Reset refs synchronously (safe)
            firstCorrectDetectionTimeRef.current = null;
            justCompletedRef.current = false;
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
    }, [isTracking, detectHandSign]);

    // Reset state when tracking stops (separate effect to avoid synchronous setState)
    useEffect(() => {
        if (!isTracking) {
            // Use setTimeout to make setState asynchronous
            const timer = setTimeout(() => {
                setDetectedLetter(null);
                setIsCorrect(null);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isTracking]);

    const toggleTracking = () => {
        setIsTracking(prev => !prev);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">ASL Alphabet Practice</h1>
                <p className="text-muted-foreground">
                    Practice signing the alphabet letters. Try to match the letter shown below!
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="w-full">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-2xl font-semibold">Hand Tracker</CardTitle>
                            <CardDescription>
                                {isTracking
                                    ? 'Sign the letter shown on the right!'
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
                                
                                {/* Detection overlay */}
                                {isTracking && detectedLetter && (
                                    <div className={`absolute top-4 left-4 px-4 py-2 rounded-lg shadow-lg ${
                                        isCorrect ? 'bg-green-500' : 'bg-orange-500'
                                    } text-white`}>
                                        <div className="text-lg font-bold">
                                            {isCorrect ? '✅ Correct!' : `Detected: ${detectedLetter}`}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <Button
                                onClick={toggleTracking}
                                variant={isTracking ? 'destructive' : 'default'}
                                size="lg"
                                className="w-full">
                                {isTracking ? '⏹ Stop Tracking' : '▶ Start Tracking'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="w-full flex flex-col">
                    <Card className="h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-2xl font-semibold">Sign This Letter</CardTitle>
                            <CardDescription>Use your webcam to sign the letter shown below</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
                            {!currentLetter ? (
                                <div className="text-muted-foreground">Loading...</div>
                            ) : (
                                <>
                                    <div className="w-full flex items-center justify-center">
                                        <div className="relative">
                                            <div className="w-64 h-64 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-4 border-primary/30 flex items-center justify-center shadow-lg">
                                                <span className="text-9xl font-bold text-primary select-none">
                                                    {currentLetter}
                                                </span>
                                            </div>
                                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary/20 rounded-full animate-pulse" />
                                            <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-primary/20 rounded-full animate-pulse delay-300" />
                                        </div>
                                    </div>

                                    <div className="text-center space-y-2">
                                        <p className="text-lg font-medium">
                                            Practice signing the letter{' '}
                                            <span className="text-primary font-bold">{currentLetter}</span>
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {isTracking
                                                ? 'Hold the sign steady for recognition'
                                                : 'Click "Start Tracking" and position your hand in front of the camera'}
                                        </p>
                                        {isCorrect && (
                                            <div className="mt-4 text-2xl font-bold text-green-500 animate-pulse">
                                                ✓ Great job! Moving to next letter...
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            <Button
                                onClick={generateRandomLetter}
                                variant="outline"
                                size="lg"
                                className="w-full sm:w-auto">
                                Get New Letter
                            </Button>
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
                                <li>Click &quot;Get New Letter&quot; to practice a different letter</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

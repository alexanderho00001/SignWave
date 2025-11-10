'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const REQUIRED_HOLD_DURATION = 50;

// Generate a random number
const getRandomNumber = () => {
    const randomIndex = Math.floor(Math.random() * NUMBERS.length);
    return NUMBERS[randomIndex];
};

export default function ASLNumbersPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentNumber, setCurrentNumber] = useState<string | null>(null);
    const [detectedNumber, setDetectedNumber] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // --- ADDED: Refs for hold logic ---
    const justCompletedRef = useRef(false);
    const firstCorrectDetectionTimeRef = useRef<number | null>(null);

    // Set random number after mount
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentNumber(getRandomNumber());
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        startWebcam();
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const startWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, facingMode: 'user' } 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
            alert("Could not access webcam. Please check permissions.");
        }
    };

    const checkSign = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || justCompletedRef.current) {
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

            const data = await response.json();
            
            if (data.letters && data.letters.length > 0) {
                const number = data.letters[0];
                setDetectedNumber(number);
                
                const correct = number === currentNumber;
                
                // --- MODIFIED: Full auto-advance logic ---
                if (correct) {
                    setIsCorrect(true); // Give immediate UI feedback

                    if (firstCorrectDetectionTimeRef.current === null) {
                        // This is the first frame we've seen it, start the timer
                        console.log('Hold registered. Starting timer...');
                        firstCorrectDetectionTimeRef.current = Date.now();
                    } else {
                        // Timer is already running, check if they've held it long enough
                        const durationHeld = Date.now() - firstCorrectDetectionTimeRef.current;
                        console.log(`Holding... ${durationHeld}ms`);
                        
                        if (durationHeld >= REQUIRED_HOLD_DURATION && !justCompletedRef.current) {
                            // SUCCESS!
                            console.log('✅ Success! Held for long enough. Getting new number.');
                            justCompletedRef.current = true; // Lock to prevent duplicates
                            
                            firstCorrectDetectionTimeRef.current = null; 

                            // Move to the next random number after a short delay
                            setTimeout(() => {
                                console.log('Moving to next number');
                                generateRandomNumber(); // Call your existing function
                                justCompletedRef.current = false; // Release the lock
                            }, 1000); // Wait 1 sec before changing
                        }
                    }
                } else {
                    // Wrong sign
                    setIsCorrect(false);
                    // Reset the timer if they stop showing the correct sign
                    firstCorrectDetectionTimeRef.current = null;
                }
                // --- END OF MODIFIED BLOCK ---

            } else {
                setDetectedNumber(null);
                setIsCorrect(null);
                // --- ADDED: Reset timer if no hand is detected ---
                firstCorrectDetectionTimeRef.current = null;
            }
        } catch (error) {
            console.error('Error checking sign:', error);
        }
    }, [currentNumber]); // `generateRandomNumber` is not needed here as it's stable

    useEffect(() => {
        if (isTracking) {
            // --- ADDED: Reset state when tracking STARTS ---
            justCompletedRef.current = false;
            firstCorrectDetectionTimeRef.current = null;
            intervalRef.current = setInterval(checkSign, 500);
        } else {
            // --- MODIFIED: Reset state when tracking STOPS ---
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            setDetectedNumber(null);
            setIsCorrect(null);
            justCompletedRef.current = false;
            firstCorrectDetectionTimeRef.current = null;
        }
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isTracking, checkSign]);

    const generateRandomNumber = () => {
        setCurrentNumber(getRandomNumber());
        setDetectedNumber(null);
        setIsCorrect(null);
        // --- ADDED: Reset state on manual change ---
        justCompletedRef.current = false;
        firstCorrectDetectionTimeRef.current = null;
    };

    const toggleTracking = () => {
        setIsTracking(prev => !prev);
    };

    return (
        // --- The rest of your JSX is perfect, no changes needed ---
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">ASL Numbers Practice (0-9)</h1>
                <p className="text-muted-foreground">
                    Practice signing numbers 0 through 9. Try to match the number shown below!
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hand Tracker Card */}
                <div className="w-full">
                    <Card className="w-full">
                        <CardHeader>
                            <CardTitle className="text-2xl font-semibold">Your Camera</CardTitle>
                            <CardDescription>
                                Track your hand movements in real-time using your webcam
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-6">
                            <div className="relative w-full">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="rounded-lg shadow-lg w-full"
                                />
                                <canvas ref={canvasRef} className="hidden" />
                                
                                {/* Detection overlay */}
                                {isTracking && detectedNumber && (
                                    <div className={`absolute top-4 left-4 px-4 py-2 rounded-lg shadow-lg ${
                                        isCorrect ? 'bg-green-500' : 'bg-orange-500'
                                    } text-white z-10`}>
                                        <div className="text-lg font-bold">
                                            {isCorrect ? '✅ Correct!' : `Detected: ${detectedNumber}`}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <Button
                                onClick={toggleTracking}
                                variant={isTracking ? 'destructive' : 'default'}
                                size="lg"
                                className="w-full sm:w-auto"
                            >
                                {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Number Display Card */}
                <div className="w-full flex flex-col">
                    <Card className="h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-2xl font-semibold">Sign This Number</CardTitle>
                            <CardDescription>Use your webcam to sign the number shown below</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
                            {currentNumber === null ? (
                                <div className="text-muted-foreground">Loading...</div>
                            ) : (
                                <>
                                    <div className="w-full flex items-center justify-center">
                                        <div className="relative">
                                            <div className="w-64 h-64 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-4 border-primary/30 flex items-center justify-center shadow-lg">
                                                <span className="text-9xl font-bold text-primary select-none">
                                                    {currentNumber}
                                                </span>
                                            </div>
                                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary/20 rounded-full animate-pulse" />
                                            <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-primary/20 rounded-full animate-pulse delay-300" />
                                        </div>
                                    </div>

                                    <div className="text-center space-y-2">
                                        <p className="text-lg font-medium">
                                            Practice signing the number{' '}
                                            <span className="text-primary font-bold">{currentNumber}</span>
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Position your hand in front of the camera and sign the number
                                        </p>
                                    </div>
                                </>
                            )}

                            <Button
                                onClick={generateRandomNumber}
                                variant="outline"
                                size="lg"
                                className="w-full sm:w-auto">
                                Get New Number
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle className="text-lg">Tips</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                                <li>Click &quot;Start Tracking&quot; to begin</li>
                                <li>Make sure your hand is fully visible in the camera</li>
                                <li>Use good lighting for better hand tracking</li>
                                <li>Keep your hand steady while signing</li>
                                <li>Click &quot;Get New Number&quot; to practice a different number</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
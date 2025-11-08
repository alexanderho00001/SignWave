'use client';

import { useRef, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type HandLandmark = {
    x: number;
    y: number;
    z?: number;
};

type HandData = HandLandmark[][];

export default function HandTracker() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [handData, setHandData] = useState<HandData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [webcamError, setWebcamError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        startWebcam();
    }, []);

    const startWebcam = async () => {
        try {
            setWebcamError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 },
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : 'Failed to access webcam. Please check permissions.';
            setWebcamError(errorMessage);
            console.error('Error accessing webcam:', err);
        }
    };

    const captureAndTrack = async () => {
        if (!videoRef.current || !canvasRef.current) {
            setError('Video or canvas element not available');
            return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
            setError('Could not get canvas context');
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg');

        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch(
                'http://localhost:8000/api/track-hands/',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ image: imageData }),
                },
            );

            // Check if response is ok
            if (!response.ok) {
                let errorMessage = `Server error: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage =
                        errorData.detail ||
                        errorData.message ||
                        errorMessage;
                } catch {
                    // If response is not JSON, try to get text
                    try {
                        const text = await response.text();
                        errorMessage = text || errorMessage;
                    } catch {
                        // If we can't read the response, use default message
                    }
                }
                throw new Error(errorMessage);
            }

            // Check if response has content
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(
                    'Server returned invalid response format. Expected JSON.',
                );
            }

            // Parse JSON response
            let data: any;
            try {
                const text = await response.text();
                if (!text || text.trim().length === 0) {
                    throw new Error('Server returned empty response');
                }
                data = JSON.parse(text);
            } catch (parseError) {
                throw new Error(
                    'Failed to parse server response. Invalid JSON format.',
                );
            }

            // Validate response structure
            if (!data || typeof data !== 'object') {
                throw new Error('Server returned invalid data structure');
            }

            // Check if hands data exists and is valid
            if (!data.hands) {
                // No hands detected is not an error, just empty result
                setHandData([]);
                // Clear canvas
                context.clearRect(0, 0, canvas.width, canvas.height);
                setIsLoading(false);
                return;
            }

            // Validate hands data structure
            if (!Array.isArray(data.hands)) {
                throw new Error(
                    'Invalid hands data format. Expected an array.',
                );
            }

            // Validate each hand is an array of landmarks
            const validHands: HandData = [];
            for (const hand of data.hands) {
                if (!Array.isArray(hand)) {
                    console.warn('Skipping invalid hand data:', hand);
                    continue;
                }

                const validLandmarks: HandLandmark[] = [];
                for (const landmark of hand) {
                    if (
                        landmark &&
                        typeof landmark === 'object' &&
                        typeof landmark.x === 'number' &&
                        typeof landmark.y === 'number'
                    ) {
                        validLandmarks.push({
                            x: landmark.x,
                            y: landmark.y,
                            z: typeof landmark.z === 'number' ? landmark.z : undefined,
                        });
                    } else {
                        console.warn('Skipping invalid landmark:', landmark);
                    }
                }

                if (validLandmarks.length > 0) {
                    validHands.push(validLandmarks);
                }
            }

            setHandData(validHands);

            // Clear canvas before drawing
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(video, 0, 0);

            // Draw hand landmarks on canvas
            if (validHands.length > 0) {
                drawHandLandmarks(
                    context,
                    validHands,
                    canvas.width,
                    canvas.height,
                );
            }
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'An unexpected error occurred while tracking hands';
            setError(errorMessage);
            console.error('Error tracking hands:', error);
            setHandData(null);
        } finally {
            setIsLoading(false);
        }
    };

    const drawHandLandmarks = (
        ctx: CanvasRenderingContext2D,
        hands: HandData,
        width: number,
        height: number,
    ) => {
        hands.forEach(hand => {
            hand.forEach(landmark => {
                const x = landmark.x * width;
                const y = landmark.y * height;

                ctx.fillStyle = '#00ff00';
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, 2 * Math.PI);
                ctx.fill();
            });
        });
    };

    const toggleTracking = () => {
        if (webcamError) {
            setError('Cannot start tracking: webcam not available');
            return;
        }
        setIsTracking(!isTracking);
        setError(null);
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTracking && !webcamError) {
            interval = setInterval(captureAndTrack, 100);
        }
        return () => clearInterval(interval);
    }, [isTracking, webcamError]);

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl font-semibold">
                    SignWave - ASL Hand Tracker
                </CardTitle>
                <CardDescription>
                    Track your hand movements in real-time using your webcam
                </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col items-center gap-6">
                {webcamError && (
                    <div className="w-full rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <p className="font-medium">Webcam Error</p>
                        <p>{webcamError}</p>
                    </div>
                )}

                {error && (
                    <div className="w-full rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <p className="font-medium">Tracking Error</p>
                        <p>{error}</p>
                    </div>
                )}

                <div className="relative w-full">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full rounded-lg border shadow-sm"
                        style={{ display: isTracking ? 'none' : 'block' }}
                    />
                    <canvas
                        ref={canvasRef}
                        className="w-full rounded-lg border shadow-sm"
                        style={{ display: isTracking ? 'block' : 'none' }}
                    />
                    {isLoading && isTracking && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                            <div className="text-sm text-muted-foreground">
                                Processing...
                            </div>
                        </div>
                    )}
                </div>

                <Button
                    onClick={toggleTracking}
                    disabled={!!webcamError}
                    variant={isTracking ? 'destructive' : 'default'}
                    size="lg"
                    className="w-full sm:w-auto"
                >
                    {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                </Button>

                {handData !== null && handData.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                        Detected {handData.length} hand(s)
                    </div>
                )}

                {handData !== null && handData.length === 0 && isTracking && (
                    <div className="text-sm text-muted-foreground">
                        No hands detected
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
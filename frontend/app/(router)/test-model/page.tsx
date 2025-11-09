'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Prediction = {
    letter: string;
    confidence: number;
};

type ModelResponse = {
    success: boolean;
    top_prediction: {
        letter: string;
        confidence: number;
    };
    all_predictions: Record<string, number>;
    raw_predictions?: Record<string, number>;
    top_5: Prediction[];
    buffer_size?: number;
    hand_detected?: boolean;
    error?: string;
};

export default function TestModelPage() {
    const [isTracking, setIsTracking] = useState(false);
    const [predictions, setPredictions] = useState<ModelResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline' | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
            setError("Could not access webcam. Please check permissions.");
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

    // Check backend connection on mount
    useEffect(() => {
        const checkBackend = async () => {
            setBackendStatus('checking');
            try {
                const response = await fetch('http://localhost:8000/api/model-status/', {
                    method: 'GET',
                });
                if (response.ok) {
                    setBackendStatus('online');
                } else {
                    setBackendStatus('offline');
                }
            } catch (err) {
                setBackendStatus('offline');
            }
        };
        checkBackend();
    }, []);

    // Test model with current frame
    const testModel = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) {
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
            setIsLoading(true);
            setError(null);

            const response = await fetch('http://localhost:8000/api/test-siglip/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ image: imageData }),
            });

            // Check if response is OK
            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                } else {
                    const text = await response.text();
                    throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
                }
            }

            // Check content type before parsing JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
            }

            const data: ModelResponse = await response.json();
            
            if (data.success) {
                setPredictions(data);
            } else {
                setError(data.error || 'Failed to get predictions');
            }
        } catch (err) {
            console.error('Error testing model:', err);
            if (err instanceof SyntaxError) {
                setError('Invalid JSON response from server. Check if backend is running and endpoint is correct.');
            } else {
                setError(err instanceof Error ? err.message : 'Failed to test model');
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Auto-detect when tracking is active
    useEffect(() => {
        if (!isTracking) {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
            return;
        }

        // Test model every 1 second when tracking
        detectionIntervalRef.current = setInterval(testModel, 1000);

        return () => {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
                detectionIntervalRef.current = null;
            }
        };
    }, [isTracking, testModel]);

    const toggleTracking = () => {
        setIsTracking(prev => !prev);
    };

    const captureAndTest = () => {
        testModel();
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">SigLIP Model Test</h1>
                <p className="text-muted-foreground">
                    Test the alphabet sign language detection model from play/model.py
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Webcam Feed */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl font-semibold">Webcam Feed</CardTitle>
                        <CardDescription>
                            {isTracking
                                ? 'Auto-detecting every second...'
                                : 'Click "Start Auto-Detection" or "Capture & Test" to test the model'}
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
                            
                            {/* Top prediction overlay */}
                            {predictions && predictions.top_prediction && (
                                <div className="absolute top-4 left-4 px-4 py-2 rounded-lg shadow-lg bg-green-500 text-white">
                                    <div className="text-2xl font-bold">
                                        {predictions.top_prediction.letter}
                                    </div>
                                    <div className="text-sm">
                                        {(predictions.top_prediction.confidence * 100).toFixed(1)}%
                                    </div>
                                </div>
                            )}
                            
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <div className="text-white text-lg">Processing...</div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            <Button
                                onClick={toggleTracking}
                                variant={isTracking ? 'destructive' : 'default'}
                                size="lg"
                                className="flex-1">
                                {isTracking ? '⏹ Stop Auto-Detection' : '▶ Start Auto-Detection'}
                            </Button>
                            <Button
                                onClick={captureAndTest}
                                disabled={isLoading}
                                variant="outline"
                                size="lg"
                                className="flex-1">
                                📸 Capture & Test
                            </Button>
                        </div>
                        <Button
                            onClick={async () => {
                                try {
                                    await fetch('http://localhost:8000/api/test-siglip/', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ reset_buffer: true }),
                                    });
                                    setPredictions(null);
                                } catch (err) {
                                    console.error('Error resetting buffer:', err);
                                }
                            }}
                            variant="outline"
                            size="sm"
                            className="w-full">
                            🔄 Reset Prediction Buffer
                        </Button>
                    </CardContent>
                </Card>

                {/* Results */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl font-semibold">Predictions</CardTitle>
                        <CardDescription>
                            Model predictions for all 26 alphabet letters
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {backendStatus === 'offline' && (
                            <div className="mb-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/40">
                                <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">⚠️ Backend Offline</p>
                                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                    Make sure the Django backend is running on http://localhost:8000
                                </p>
                            </div>
                        )}
                        
                        {error && (
                            <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/40">
                                <p className="text-sm text-destructive font-medium">Error</p>
                                <p className="text-sm text-destructive">{error}</p>
                            </div>
                        )}

                        {predictions && (
                            <div className="space-y-6">
                                {/* Model Info */}
                                {predictions.buffer_size !== undefined && (
                                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Buffer Size:</span>
                                            <span className="font-medium">{predictions.buffer_size}/5</span>
                                        </div>
                                        {predictions.hand_detected !== undefined && (
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-muted-foreground">Hand Detected:</span>
                                                <span className={`font-medium ${predictions.hand_detected ? 'text-green-600' : 'text-yellow-600'}`}>
                                                    {predictions.hand_detected ? '✓ Yes' : '⚠ No'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Top Prediction */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Top Prediction (Smoothed)</h3>
                                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                                        <div className="text-4xl font-bold text-primary mb-1">
                                            {predictions.top_prediction.letter}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Confidence: {(predictions.top_prediction.confidence * 100).toFixed(2)}%
                                        </div>
                                        {predictions.raw_predictions && (
                                            <div className="mt-2 pt-2 border-t border-primary/20">
                                                <div className="text-xs text-muted-foreground">
                                                    Raw (current frame): {Object.entries(predictions.raw_predictions)
                                                        .sort(([, a], [, b]) => b - a)[0][0]} 
                                                    ({(Object.entries(predictions.raw_predictions)
                                                        .sort(([, a], [, b]) => b - a)[0][1] * 100).toFixed(1)}%)
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Top 5 Predictions */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Top 5 Predictions</h3>
                                    <div className="space-y-2">
                                        {predictions.top_5.map((pred, index) => (
                                            <div
                                                key={pred.letter}
                                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-medium text-muted-foreground w-6">
                                                        #{index + 1}
                                                    </span>
                                                    <span className="text-xl font-bold">{pred.letter}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-32 bg-muted rounded-full h-2">
                                                        <div
                                                            className="bg-primary h-2 rounded-full transition-all"
                                                            style={{
                                                                width: `${pred.confidence * 100}%`,
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-medium w-12 text-right">
                                                        {(pred.confidence * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* All Predictions Grid */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">All Predictions</h3>
                                    <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto p-2">
                                        {Object.entries(predictions.all_predictions)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([letter, confidence]) => (
                                                <div
                                                    key={letter}
                                                    className={`p-2 rounded text-center border ${
                                                        letter === predictions.top_prediction.letter
                                                            ? 'bg-primary/20 border-primary'
                                                            : 'bg-muted/30 border-muted'
                                                    }`}>
                                                    <div className="text-lg font-bold">{letter}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {(confidence * 100).toFixed(1)}%
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {!predictions && !error && (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No predictions yet.</p>
                                <p className="text-sm mt-2">
                                    Start auto-detection or click "Capture & Test" to begin.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


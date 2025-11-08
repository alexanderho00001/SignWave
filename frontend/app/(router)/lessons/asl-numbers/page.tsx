'use client';

import { useState, useEffect } from 'react';
import HandTracker from '@/components/HandTracker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Generate a random number
const getRandomNumber = () => {
    const randomIndex = Math.floor(Math.random() * NUMBERS.length);
    return NUMBERS[randomIndex];
};

export default function ASLNumbersPage() {
    // Always initialize with null to ensure server and client render the same
    const [currentNumber, setCurrentNumber] = useState<number | null>(null);

    // Set random number after mount using async update to avoid synchronous setState warning
    useEffect(() => {
        // Use setTimeout to make the state update asynchronous
        // This avoids the synchronous setState warning while ensuring hydration safety
        const timer = setTimeout(() => {
            setCurrentNumber(getRandomNumber());
        }, 0);

        return () => clearTimeout(timer);
    }, []);

    const generateRandomNumber = () => {
        const randomIndex = Math.floor(Math.random() * NUMBERS.length);
        setCurrentNumber(NUMBERS[randomIndex]);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">ASL Numbers Practice (1-10)</h1>
                <p className="text-muted-foreground">
                    Practice signing numbers 1 through 10. Try to match the number shown below!
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="w-full">
                    <HandTracker />
                </div>

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

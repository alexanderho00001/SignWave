'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { ASLVisualization } from './ASLVisualization';

// --- MODIFIED: Changed to Numbers 0-9 ---
const ASL_NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const REQUIRED_HOLD_DURATION = 200;

export default function ASLNumberPractice() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // --- MODIFIED: State variable names ---
  const [currentNumber, setCurrentNumber] = useState(ASL_NUMBERS[0]);
  const [detectedItem, setDetectedItem] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [showVisualization, setShowVisualization] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);

  const justCompletedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const firstCorrectDetectionTimeRef = useRef<number | null>(null);

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
      // --- MODIFIED: Call the new /api/track-numbers/ endpoint ---
      const response = await fetch('http://localhost:8000/api/track-numbers/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });

      const data = await response.json();
      
      // --- MODIFIED: Use 'data.letters' as the key ---
      // (We kept the key 'letters' in the backend for simplicity)
      if (data.letters && data.letters.length > 0) {
        const item = data.letters[0];
        setDetectedItem(item);
        
        const correct = item === currentNumber;
        
        if (correct) {
          setIsCorrect(true);

          if (firstCorrectDetectionTimeRef.current === null) {
            console.log('Hold registered. Starting timer...');
            firstCorrectDetectionTimeRef.current = Date.now();
          } else {
            const durationHeld = Date.now() - firstCorrectDetectionTimeRef.current;
            console.log(`Holding... ${durationHeld}ms`);
            
            if (durationHeld >= REQUIRED_HOLD_DURATION && !justCompletedRef.current) {
              console.log('✅ Success! Held for long enough.');
              justCompletedRef.current = true;
              
              setScore(prev => prev + 1);
              setAttempts(prev => prev + 1);
              
              firstCorrectDetectionTimeRef.current = null; 

              setTimeout(() => {
                console.log('Moving to next number');
                const currentIndex = ASL_NUMBERS.indexOf(currentNumber);
                const nextIndex = (currentIndex + 1) % ASL_NUMBERS.length;
                const nextNumber = ASL_NUMBERS[nextIndex];
                
                console.log(`Changing from ${currentNumber} to ${nextNumber}`);
                setCurrentNumber(nextNumber);
                
                setIsCorrect(null);
                setDetectedItem(null);
                setWrongAttempts(0); // Reset wrong attempts on success
                justCompletedRef.current = false;
              }, 1500);
            }
          }
        } else {
          console.log('❌ Wrong sign. Resetting timer.');
          setIsCorrect(false);
          firstCorrectDetectionTimeRef.current = null;
          setAttempts(prev => prev + 1);
          setWrongAttempts(prev => {
            const newCount = prev + 1;
            // Auto-show demo after 3 wrong attempts
            if (newCount >= 3) {
              setShowVisualization(true);
              return 0; // Reset counter after showing demo
            }
            return newCount;
          });
        }

      } else {
        setDetectedItem(null);
        firstCorrectDetectionTimeRef.current = null;
        if (!justCompletedRef.current) {
          setIsCorrect(null);
        }
      }
    } catch (error) {
      console.error('Error checking sign:', error);
    }
  }, [currentNumber]); 

  useEffect(() => {
    if (isTracking) {
      justCompletedRef.current = false;
      firstCorrectDetectionTimeRef.current = null; 
      
      intervalRef.current = setInterval(checkSign, 500);
      console.log("Tracking started, interval set.");
      
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log("Tracking stopped, interval cleared.");
      }
      setDetectedItem(null);
      setIsCorrect(null);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTracking, checkSign]);

  const resetGame = () => {
    setScore(0);
    setAttempts(0);
    setCurrentNumber(ASL_NUMBERS[0]);
    setDetectedItem(null);
    setIsCorrect(null);
    justCompletedRef.current = false;
    firstCorrectDetectionTimeRef.current = null;
  };

  const toggleTracking = () => {
    setIsTracking(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2">SignWave</h1>
        {/* --- MODIFIED: Text --- */}
        <p className="text-center text-gray-600 mb-8">Practice ASL Numbers - Live Camera</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left side - Camera */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Your Camera</h2>
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="rounded-lg shadow-lg w-full"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {isTracking && detectedItem && (
                <div className={`absolute top-4 left-4 px-4 py-2 rounded-lg shadow-lg ${
                  isCorrect ? 'bg-green-500' : 'bg-orange-500'
                } text-white`}>
                  <div className="text-lg font-bold">
                    {/* --- MODIFIED: Text --- */}
                    {isCorrect ? '✅ Correct!' : `Detected: ${detectedItem}`}
                  </div>
                </div>
              )}

              {wrongAttempts > 0 && wrongAttempts < 3 && (
                <div className="absolute bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg bg-yellow-500 text-white">
                  <div className="text-sm font-bold">
                    Wrong attempts: {wrongAttempts}/3
                  </div>
                  <div className="text-xs">
                    (Demo will auto-show at 3)
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={toggleTracking}
              className={`w-full mt-4 py-3 rounded-lg transition font-semibold ${
                isTracking
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isTracking ? '⏹ Stop Tracking' : '▶ Start Tracking'}
            </button>
          </div>

          {/* Right side - Instructions */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">Current Challenge</h2>
            
            {/* --- MODIFIED: Text --- */}
            <div className="text-center mb-6">
              <div className="text-sm text-gray-500 mb-2">Make this sign:</div>
              <div className="text-9xl font-bold text-blue-600 mb-4">
                {currentNumber}
              </div>
              <div className="text-sm text-gray-600">
                Number {ASL_NUMBERS.indexOf(currentNumber) + 1} of {ASL_NUMBERS.length}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-600">
                <p className="mb-2"><strong>How to play:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click "Start Tracking"</li>
                  <li>Make the sign shown above</li>
                  <li>Hold the sign steady for recognition</li>
                  <li>Move to the next number when correct!</li>
                </ol>
              </div>

              <button
                onClick={() => setShowVisualization(true)}
                className="w-full mt-4 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
              >
                📹 Show Me How to Sign "{currentNumber}"
              </button>
            </div>

            {/* Score card */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="text-sm text-gray-600">Your Score</div>
                  <div className="text-3xl font-bold text-blue-600">
                    {score} / {attempts}
                  </div>
                </div>
                <button
                  onClick={resetGame}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition text-sm"
                >
                  Reset
                </button>
              </div>
              
              {attempts > 0 && (
                <div className="text-sm text-gray-600">
                  Accuracy: {Math.round((score / attempts) * 100)}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Available numbers */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Available Numbers</h2>
          <div className="flex flex-wrap gap-2">
            {ASL_NUMBERS.map(num => (
              <span
                key={num}
                className={`px-4 py-2 rounded-lg font-medium ${
                  num === currentNumber
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {num}
              </span>
            ))}
          </div>
        </div>

        {/* Visualization Modal */}
        {showVisualization && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="max-w-2xl w-full">
              <ASLVisualization
                signName={currentNumber}
                signType="numbers"
                onClose={() => setShowVisualization(false)}
                autoPlay={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
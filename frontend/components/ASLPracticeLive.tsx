'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

const ASL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'L', 'V', 'Y'];
const REQUIRED_HOLD_DURATION = 500; // 1/2 a second

export default function ASLPracticeLive() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentLetter, setCurrentLetter] = useState(ASL_LETTERS[0]);
  const [detectedLetter, setDetectedLetter] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  
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
        
        // --- NEW: Logic to check for hold duration ---
        if (correct) {
          // User is showing the right sign
          setIsCorrect(true); // Give immediate positive feedback

          if (firstCorrectDetectionTimeRef.current === null) {
            // This is the FIRST frame we've seen the correct sign.
            // Start the timer.
            console.log('Hold registered. Starting timer...');
            firstCorrectDetectionTimeRef.current = Date.now();
          } else {
            // We've seen this sign before. Check if they've held it long enough.
            const durationHeld = Date.now() - firstCorrectDetectionTimeRef.current;
            console.log(`Holding... ${durationHeld}ms`);
            
            if (durationHeld >= REQUIRED_HOLD_DURATION && !justCompletedRef.current) {
              // SUCCESS! They held it.
              console.log('✅ Success! Held for long enough.');
              justCompletedRef.current = true; // Set the lock
              
              setScore(prev => prev + 1);
              setAttempts(prev => prev + 1);
              
              // Reset the hold timer for the next letter
              firstCorrectDetectionTimeRef.current = null; 

              // Move to next letter after success
              setTimeout(() => {
                console.log('Moving to next letter');
                const currentIndex = ASL_LETTERS.indexOf(currentLetter);
                const nextIndex = (currentIndex + 1) % ASL_LETTERS.length;
                const nextLetter = ASL_LETTERS[nextIndex];
                
                console.log(`Changing from ${currentLetter} to ${nextLetter}`);
                setCurrentLetter(nextLetter);
                
                setIsCorrect(null);
                setDetectedLetter(null);
                justCompletedRef.current = false; // Reset the lock
              }, 1500); // Keep the 1.5s delay so they see the success
            }
          }
        } else {
          // User is showing the WRONG sign
          console.log('❌ Wrong sign. Resetting timer.');
          setIsCorrect(false);
          // NEW: Reset the timer if the sign is wrong
          firstCorrectDetectionTimeRef.current = null;
        }
        // --- End of new logic ---

      } else {
        // NO hand detected
        setDetectedLetter(null);
        // NEW: Reset the timer if no hand is seen
        firstCorrectDetectionTimeRef.current = null;
        if (!justCompletedRef.current) {
          setIsCorrect(null);
        }
      }
    } catch (error) {
      console.error('Error checking sign:', error);
    }
  }, [currentLetter]); 

  useEffect(() => {
    if (isTracking) {
      justCompletedRef.current = false;
      // NEW: Reset timer on start
      firstCorrectDetectionTimeRef.current = null; 
      
      intervalRef.current = setInterval(checkSign, 500);
      console.log("Tracking started, interval set.");
      
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log("Tracking stopped, interval cleared.");
      }
      setDetectedLetter(null);
      setIsCorrect(null);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isTracking, checkSign]);

  const nextLetter = () => {
    const currentIndex = ASL_LETTERS.indexOf(currentLetter);
    const nextIndex = (currentIndex + 1) % ASL_LETTERS.length;
    setCurrentLetter(ASL_LETTERS[nextIndex]);
    setDetectedLetter(null);
    setIsCorrect(null);
    justCompletedRef.current = false;
    // NEW: Reset timer
    firstCorrectDetectionTimeRef.current = null;
  };

  const resetGame = () => {
    setScore(0);
    setAttempts(0);
    setCurrentLetter(ASL_LETTERS[0]);
    setDetectedLetter(null);
    setIsCorrect(null);
    justCompletedRef.current = false;
    // NEW: Reset timer
    firstCorrectDetectionTimeRef.current = null;
  };

  const toggleTracking = () => {
    setIsTracking(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      {/* ... (The rest of your JSX remains exactly the same) ... */}
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2">SignWave</h1>
        <p className="text-center text-gray-600 mb-8">Practice ASL Letters - Live Camera</p>

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
            
            <div className="text-center mb-6">
              <div className="text-sm text-gray-500 mb-2">Make this sign:</div>
              <div className="text-9xl font-bold text-blue-600 mb-4">
                {currentLetter}
              </div>
              <div className="text-sm text-gray-600">
                Letter {ASL_LETTERS.indexOf(currentLetter) + 1} of {ASL_LETTERS.length}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-600">
                <p className="mb-2"><strong>How to play:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Click "Start Tracking"</li>
                  <li>Make the sign shown above</li>
                  <li>Hold the sign steady for recognition</li>
                  <li>Move to the next letter when correct!</li>
                </ol>
              </div>
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

        {/* Available letters */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Available Letters</h2>
          <div className="flex flex-wrap gap-2">
            {ASL_LETTERS.map(letter => (
              <span
                key={letter}
                className={`px-4 py-2 rounded-lg font-medium ${
                  letter === currentLetter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {letter}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';

const ASL_LETTERS = ['A', 'B', 'C', 'I', 'L', 'V', 'Y'];

export default function ASLPractice() {
  const [currentLetter, setCurrentLetter] = useState(ASL_LETTERS[0]);
  const [result, setResult] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      
      try {
        const response = await fetch('http://localhost:8000/api/track-hands/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: base64Image }),
        });

        const data = await response.json();
        
        if (data.letters && data.letters.length > 0) {
          const detectedLetter = data.letters[0];
          setResult(detectedLetter);
          
          const correct = detectedLetter === currentLetter;
          setIsCorrect(correct);
          setAttempts(attempts + 1);
          
          if (correct) {
            setScore(score + 1);
            // Move to next letter after 1 second
            setTimeout(() => {
              nextLetter();
            }, 1500);
          }
        } else {
          setResult('No hand detected');
          setIsCorrect(false);
        }
      } catch (error) {
        console.error('Error:', error);
        setResult('Error processing image');
        setIsCorrect(false);
      }
    };
    
    reader.readAsDataURL(file);
  };

  const nextLetter = () => {
    const currentIndex = ASL_LETTERS.indexOf(currentLetter);
    const nextIndex = (currentIndex + 1) % ASL_LETTERS.length;
    setCurrentLetter(ASL_LETTERS[nextIndex]);
    setResult(null);
    setIsCorrect(null);
  };

  const resetGame = () => {
    setScore(0);
    setAttempts(0);
    setCurrentLetter(ASL_LETTERS[0]);
    setResult(null);
    setIsCorrect(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2">SignWave</h1>
        <p className="text-center text-gray-600 mb-8">Practice ASL Letters</p>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <div className="text-sm text-gray-500 mb-2">Make this sign:</div>
            <div className="text-8xl font-bold text-blue-600 mb-4">
              {currentLetter}
            </div>
            <div className="text-sm text-gray-600">
              Letter {ASL_LETTERS.indexOf(currentLetter) + 1} of {ASL_LETTERS.length}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg"
          >
            📸 Take Photo / Upload Image
          </button>

          {result && (
            <div className={`mt-6 p-4 rounded-lg text-center ${
              isCorrect 
                ? 'bg-green-100 border-2 border-green-500' 
                : 'bg-red-100 border-2 border-red-500'
            }`}>
              <div className="text-2xl font-bold mb-2">
                {isCorrect ? '✅ Correct!' : '❌ Try Again'}
              </div>
              <div className="text-lg">
                Detected: <span className="font-bold">{result}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="text-sm text-gray-600">Score</div>
              <div className="text-3xl font-bold text-blue-600">
                {score} / {attempts}
              </div>
            </div>
            <button
              onClick={resetGame}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
            >
              Reset
            </button>
          </div>

          <div className="text-sm text-gray-600">
            <div className="font-semibold mb-2">Available Letters:</div>
            <div className="flex flex-wrap gap-2">
              {ASL_LETTERS.map(letter => (
                <span
                  key={letter}
                  className={`px-3 py-1 rounded ${
                    letter === currentLetter
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100'
                  }`}
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useRef, useEffect, useState } from 'react';

export default function HandTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [handData, setHandData] = useState<any>(null);

  useEffect(() => {
    startWebcam();
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
    }
  };

  const captureAndTrack = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg');

    try {
      const response = await fetch('http://localhost:8000/api/track_hands/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });

      const data = await response.json();
      setHandData(data.hands);

      // Draw hand landmarks on canvas
      if (data.hands && data.hands.length > 0) {
        drawHandLandmarks(context, data.hands, canvas.width, canvas.height);
      }
    } catch (error) {
      console.error('Error tracking hands:', error);
    }
  };

  const drawHandLandmarks = (
    ctx: CanvasRenderingContext2D,
    hands: any[],
    width: number,
    height: number
  ) => {
    hands.forEach(hand => {
      hand.forEach((landmark: any) => {
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
    setIsTracking(!isTracking);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTracking) {
      interval = setInterval(captureAndTrack, 100);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h1 className="text-3xl font-bold">SignWave - ASL Hand Tracker</h1>

      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="rounded-lg shadow-lg"
          style={{ display: isTracking ? 'none' : 'block' }}
        />
        <canvas
          ref={canvasRef}
          className="rounded-lg shadow-lg"
          style={{ display: isTracking ? 'block' : 'none' }}
        />
      </div>

      <button
        onClick={toggleTracking}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        {isTracking ? 'Stop Tracking' : 'Start Tracking'}
      </button>

      {handData && handData.length > 0 && (
        <div className="text-sm text-gray-600">
          Detected {handData.length} hand(s)
        </div>
      )}
    </div>
  );
}
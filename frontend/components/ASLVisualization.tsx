"use client";

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface Landmark {
  type: string;
  landmark_index: number;
  x: number;
  y: number;
  z: number;
}

interface Frame {
  frame: number;
  landmarks: Landmark[];
}

interface ReferenceSignData {
  total_frames: number;
  frames: Frame[];
}

interface ASLVisualizationProps {
  signName: string;
  signType?: 'words' | 'letters' | 'numbers';
  onClose?: () => void;
  autoPlay?: boolean;
}

// Enhanced color scheme for better visibility
const getColor = (type: string): string => {
  if (type === 'face') return 'rgba(255, 100, 100, 0.4)'; // Semi-transparent red for face
  if (type.includes('hand')) return '#00FF00'; // Bright green for hands
  return '#00D9FF'; // Cyan for pose
};

const getMarkerSize = (type: string): number => {
  if (type === 'face') return 3; // Smaller for face
  if (type.includes('hand')) return 12; // Larger for hands
  return 8; // Medium for pose
};

// Define MediaPipe hand connections (0-20 for each hand)
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm connections
  [5, 9], [9, 13], [13, 17]
];

// Pose connections for body skeleton
const POSE_CONNECTIONS = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  // Shoulders and torso
  [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24],
  // Legs
  [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32]
];

export function ASLVisualization({
  signName,
  signType,
  onClose,
  autoPlay = true
}: ASLVisualizationProps) {
  const [data, setData] = useState<ReferenceSignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [playbackSpeed, setPlaybackSpeed] = useState(0.5); // 0.5 = half speed, 1 = normal, 2 = double
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch reference sign data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const typeParam = signType ? `?sign_type=${signType}` : '';
        const response = await fetch(
          `http://localhost:8000/api/reference-sign/${signName}/${typeParam}`
        );

        if (!response.ok) {
          throw new Error(`Failed to load reference sign: ${signName}`);
        }

        const result = await response.json();
        setData(result.data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    fetchData();
  }, [signName, signType]);

  // Animation loop with variable speed
  useEffect(() => {
    if (!isPlaying || !data) return;

    const baseFrameTime = 100; // 100ms = 10 FPS at normal speed
    const frameTime = baseFrameTime / playbackSpeed; // Adjust based on speed

    intervalRef.current = setInterval(() => {
      setCurrentFrame((prev) => {
        if (prev >= data.frames.length - 1) {
          return 0; // Loop back to start
        }
        return prev + 1;
      });
    }, frameTime);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, data, playbackSpeed]);

  // Prepare plot data for current frame with enhanced visualization
  const getPlotData = () => {
    if (!data || !data.frames[currentFrame]) return [];

    const frame = data.frames[currentFrame];
    const traces: any[] = [];

    // Separate landmarks by type
    const handLandmarks: Landmark[] = [];
    const poseLandmarks: Landmark[] = [];
    const faceLandmarks: Landmark[] = [];

    frame.landmarks.forEach((landmark) => {
      if (landmark.type.includes('hand')) {
        handLandmarks.push(landmark);
      } else if (landmark.type === 'pose') {
        poseLandmarks.push(landmark);
      } else if (landmark.type === 'face') {
        faceLandmarks.push(landmark);
      }
    });

    // Draw pose skeleton first (background layer)
    if (poseLandmarks.length > 0) {
      const poseMap = new Map<number, Landmark>();
      poseLandmarks.forEach(l => poseMap.set(l.landmark_index, l));

      // Draw pose connections
      POSE_CONNECTIONS.forEach(([start, end]) => {
        const startLm = poseMap.get(start);
        const endLm = poseMap.get(end);
        if (startLm && endLm) {
          traces.push({
            x: [startLm.x, endLm.x],
            y: [startLm.y, endLm.y],
            mode: 'lines',
            type: 'scatter',
            line: {
              color: '#00D9FF',
              width: 3,
            },
            showlegend: false,
            hoverinfo: 'skip',
          });
        }
      });

      // Draw pose points
      traces.push({
        x: poseLandmarks.map(l => l.x),
        y: poseLandmarks.map(l => l.y),
        mode: 'markers',
        type: 'scatter',
        marker: {
          color: '#00D9FF',
          size: 8,
          line: {
            color: '#FFFFFF',
            width: 1
          }
        },
        showlegend: false,
        hoverinfo: 'skip',
      });
    }

    // Draw face landmarks (subtle)
    if (faceLandmarks.length > 0) {
      traces.push({
        x: faceLandmarks.map(l => l.x),
        y: faceLandmarks.map(l => l.y),
        mode: 'markers',
        type: 'scatter',
        marker: {
          color: 'rgba(255, 100, 100, 0.3)',
          size: 2,
        },
        showlegend: false,
        hoverinfo: 'skip',
      });
    }

    // Draw hands with enhanced visibility (foreground layer)
    const leftHandLandmarks = handLandmarks.filter(l => l.type === 'left_hand');
    const rightHandLandmarks = handLandmarks.filter(l => l.type === 'right_hand');

    [leftHandLandmarks, rightHandLandmarks].forEach((handLms, idx) => {
      if (handLms.length === 0) return;

      const handMap = new Map<number, Landmark>();
      handLms.forEach(l => handMap.set(l.landmark_index, l));

      const handColor = idx === 0 ? '#00FF00' : '#FFD700'; // Green for left, gold for right

      // Draw hand connections with thick lines
      HAND_CONNECTIONS.forEach(([start, end]) => {
        const startLm = handMap.get(start);
        const endLm = handMap.get(end);
        if (startLm && endLm) {
          traces.push({
            x: [startLm.x, endLm.x],
            y: [startLm.y, endLm.y],
            mode: 'lines',
            type: 'scatter',
            line: {
              color: handColor,
              width: 8,
            },
            showlegend: false,
            hoverinfo: 'skip',
          });
        }
      });

      // Draw hand points
      traces.push({
        x: handLms.map(l => l.x),
        y: handLms.map(l => l.y),
        mode: 'markers',
        type: 'scatter',
        marker: {
          color: handColor,
          size: 12,
          line: {
            color: '#FFFFFF',
            width: 2
          }
        },
        showlegend: false,
        hoverinfo: 'skip',
      });
    });

    return traces;
  };

  const layout = {
    title: {
      text: `ASL Sign: "${signName}" | Frame ${currentFrame + 1}/${data?.total_frames || 0}`,
      font: {
        size: 20,
        color: '#FFFFFF',
        family: 'Arial, sans-serif'
      }
    },
    width: 600,
    height: 800,
    xaxis: {
      visible: false,
      range: [0, 1],
    },
    yaxis: {
      visible: false,
      range: [1, 0], // Reversed for proper orientation
      scaleanchor: 'x',
    },
    showlegend: false,
    margin: { l: 20, r: 20, t: 80, b: 20 },
    paper_bgcolor: '#000000', // Black background for X-ray effect
    plot_bgcolor: '#000000',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading sign visualization...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-900/30 border border-red-500 rounded-lg">
        <h3 className="text-red-400 font-semibold mb-2">
          Visualization Not Available
        </h3>
        <p className="text-red-300 mb-4">
          {error || `No reference video found for "${signName}"`}
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="asl-visualization bg-gray-900 rounded-lg shadow-2xl p-6 border border-gray-700">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span className="text-gray-300">Left Hand</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-gray-300">Right Hand</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
            <span className="text-gray-300">Body</span>
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      <div className="visualization-container bg-black rounded-lg overflow-hidden border-2 border-cyan-500/30">
        <Plot
          data={getPlotData()}
          layout={layout}
          config={{
            displayModeBar: false,
            responsive: true,
          }}
        />
      </div>

      <div className="controls mt-4 space-y-4">
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm text-gray-400">Speed:</span>
          <button
            onClick={() => setPlaybackSpeed(0.25)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              playbackSpeed === 0.25
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            0.25x
          </button>
          <button
            onClick={() => setPlaybackSpeed(0.5)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              playbackSpeed === 0.5
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            0.5x
          </button>
          <button
            onClick={() => setPlaybackSpeed(1)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              playbackSpeed === 1
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            1x
          </button>
          <button
            onClick={() => setPlaybackSpeed(1.5)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              playbackSpeed === 1.5
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            1.5x
          </button>
        </div>
      </div>

    </div>
  );
}

export default ASLVisualization;

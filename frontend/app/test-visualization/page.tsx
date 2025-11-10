"use client";

import { ASLVisualization } from '@/components/ASLVisualization';
import { useState } from 'react';

const AVAILABLE_SIGNS = ['blow', 'wait', 'cloud', 'bird', 'owie', 'duck', 'minemy', 'lips', 'flower', 'time'];

export default function TestVisualizationPage() {
  const [selectedSign, setSelectedSign] = useState('blow');

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2">ASL Visualization Demo</h1>
        <p className="text-center text-gray-600 mb-8">Test the sign language visualization system</p>

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Select a sign to visualize:</h2>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_SIGNS.map(sign => (
              <button
                key={sign}
                onClick={() => setSelectedSign(sign)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sign === selectedSign
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {sign}
              </button>
            ))}
          </div>
        </div>

        <ASLVisualization
          signName={selectedSign}
          signType="words"
          autoPlay={true}
        />

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-2">Integration Status</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✅ Backend API endpoint working</li>
            <li>✅ Parquet to JSON conversion successful</li>
            <li>✅ React visualization component created</li>
            <li>✅ Plotly.js animation working</li>
            <li>✅ 10 sample signs available (words)</li>
            <li>⚠️ Need to record reference signs for letters (A-Z) and numbers (0-9)</li>
          </ul>
        </div>

        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-bold text-lg mb-2">Next Steps</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>Convert all 250 words from the ASL-signs dataset</li>
            <li>Create a recording tool for letters and numbers</li>
            <li>Integrate visualization into all practice components</li>
            <li>Add "Show me how" button to display when user gets sign wrong</li>
            <li>Test with real users and gather feedback</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

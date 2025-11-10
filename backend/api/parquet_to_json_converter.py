"""
Utility to convert ASL-signs parquet files to JSON format for frontend consumption
"""
import pandas as pd
import numpy as np
import json
import os
from pathlib import Path


def convert_parquet_to_json(parquet_path, output_path=None):
    """
    Convert a parquet file containing ASL sign landmarks to JSON format.

    Args:
        parquet_path: Path to the parquet file
        output_path: Optional path to save JSON file. If None, returns JSON string.

    Returns:
        dict: JSON-serializable dictionary with landmark data
    """
    # Read the parquet file
    df = pd.read_parquet(parquet_path)

    # Get unique frames
    frames = sorted(df['frame'].unique())

    # Structure data by frames
    frames_data = []
    for frame_num in frames:
        frame_df = df[df['frame'] == frame_num]

        landmarks = []
        for _, row in frame_df.iterrows():
            # Convert to float and handle NaN/Inf values
            x = float(row['x']) if pd.notna(row['x']) else 0.0
            y = float(row['y']) if pd.notna(row['y']) else 0.0
            z = float(row['z']) if pd.notna(row['z']) else 0.0

            # Replace inf with 0
            x = 0.0 if not np.isfinite(x) else x
            y = 0.0 if not np.isfinite(y) else y
            z = 0.0 if not np.isfinite(z) else z

            landmarks.append({
                'type': row['type'],
                'landmark_index': int(row['landmark_index']),
                'x': x,
                'y': y,
                'z': z
            })

        frames_data.append({
            'frame': int(frame_num),
            'landmarks': landmarks
        })

    result = {
        'total_frames': len(frames),
        'frames': frames_data
    }

    # Save to file if output path provided
    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Saved JSON to {output_path}")

    return result


def batch_convert_signs(asl_signs_dir, train_csv_path, output_dir, limit=None):
    """
    Batch convert parquet files to JSON for specific signs.

    Args:
        asl_signs_dir: Root directory of asl-signs dataset
        train_csv_path: Path to train.csv
        output_dir: Directory to save JSON files
        limit: Optional limit on number of signs to convert (for testing)
    """
    # Read train.csv to get sign mappings
    train_df = pd.read_csv(train_csv_path)

    # Group by sign to get one example per sign
    signs_processed = {}
    count = 0

    for _, row in train_df.iterrows():
        sign = row['sign']

        # Skip if we already have this sign
        if sign in signs_processed:
            continue

        # Construct parquet file path
        parquet_path = os.path.join(asl_signs_dir, row['path'])

        if not os.path.exists(parquet_path):
            print(f"Warning: File not found: {parquet_path}")
            continue

        # Convert to JSON
        output_path = os.path.join(output_dir, 'words', f'{sign}.json')

        try:
            convert_parquet_to_json(parquet_path, output_path)
            signs_processed[sign] = True
            count += 1

            if limit and count >= limit:
                break

        except Exception as e:
            print(f"Error converting {sign}: {e}")
            continue

    print(f"\nConverted {count} signs to JSON format")
    return signs_processed


def create_reference_from_recording(landmarks_sequence, sign_name, sign_type, output_dir):
    """
    Create a reference sign JSON from a recorded sequence of landmarks.

    Args:
        landmarks_sequence: List of landmark dictionaries per frame
        sign_name: Name of the sign (e.g., 'A', '5', 'hello')
        sign_type: 'letters', 'numbers', or 'words'
        output_dir: Base directory for reference signs
    """
    frames_data = []

    for frame_idx, landmarks in enumerate(landmarks_sequence):
        frames_data.append({
            'frame': frame_idx,
            'landmarks': landmarks
        })

    result = {
        'total_frames': len(frames_data),
        'frames': frames_data
    }

    # Save to appropriate directory
    output_path = os.path.join(output_dir, sign_type, f'{sign_name}.json')
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"Created reference sign: {output_path}")
    return result


if __name__ == "__main__":
    # Example usage - convert a few signs for testing
    ASL_SIGNS_DIR = r"C:\Users\rimsh\Downloads\asl-signs"
    TRAIN_CSV = os.path.join(ASL_SIGNS_DIR, "train.csv")
    OUTPUT_DIR = r"c:\Users\rimsh\Desktop\SignWave\backend\reference_signs"

    print("Converting sample signs for testing...")
    print("This will convert the first occurrence of each sign type.")
    print("=" * 60)

    # Convert first 10 signs for testing
    batch_convert_signs(ASL_SIGNS_DIR, TRAIN_CSV, OUTPUT_DIR, limit=10)

    print("\n" + "=" * 60)
    print("Conversion complete!")
    print(f"Check {OUTPUT_DIR}/words/ for converted JSON files")

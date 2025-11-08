"""
Utility functions for ASL model data processing and preprocessing.
"""

import numpy as np
import json
from typing import List, Dict, Optional


def normalize_landmarks(landmarks: List[Dict], method='relative'):
    """
    Normalize hand landmarks for better model performance.
    
    Args:
        landmarks: List of 21 landmarks with x, y, z coordinates
        method: Normalization method ('relative', 'centered', 'minmax')
    
    Returns:
        Normalized landmarks
    """
    if not landmarks or len(landmarks) != 21:
        raise ValueError("Expected 21 landmarks")
    
    # Convert to numpy array
    coords = np.array([
        [lm['x'], lm['y'], lm['z']] for lm in landmarks
    ], dtype=np.float32)
    
    if method == 'relative':
        # Normalize relative to wrist (landmark 0)
        wrist = coords[0]
        normalized = coords - wrist
        # Scale by a reference distance (e.g., distance from wrist to middle finger MCP)
        reference_dist = np.linalg.norm(coords[9] - wrist)
        if reference_dist > 0:
            normalized = normalized / reference_dist
    
    elif method == 'centered':
        # Center around wrist
        wrist = coords[0]
        normalized = coords - wrist
    
    elif method == 'minmax':
        # Min-max normalization per coordinate
        for i in range(3):  # x, y, z
            min_val = coords[:, i].min()
            max_val = coords[:, i].max()
            if max_val - min_val > 0:
                coords[:, i] = (coords[:, i] - min_val) / (max_val - min_val)
        normalized = coords
    
    else:
        normalized = coords
    
    # Convert back to list of dicts
    normalized_landmarks = [
        {'x': float(normalized[i, 0]), 'y': float(normalized[i, 1]), 'z': float(normalized[i, 2])}
        for i in range(21)
    ]
    
    return normalized_landmarks


def landmarks_to_features(landmarks: List[Dict]) -> np.ndarray:
    """
    Convert landmarks to feature vector.
    
    Args:
        landmarks: List of 21 landmarks with x, y, z coordinates
    
    Returns:
        Feature vector of shape (63,) - flattened 21×3 coordinates
    """
    features = []
    for landmark in landmarks:
        features.extend([landmark['x'], landmark['y'], landmark['z']])
    return np.array(features, dtype=np.float32)


def create_sequence_data(landmarks_list: List[List[Dict]], sequence_length: int = 5):
    """
    Create sequence data from multiple frames of landmarks.
    
    Args:
        landmarks_list: List of landmark frames, each with 21 landmarks
        sequence_length: Desired sequence length
    
    Returns:
        List of sequences, each containing sequence_length frames
    """
    sequences = []
    
    for i in range(len(landmarks_list) - sequence_length + 1):
        sequence = landmarks_list[i:i + sequence_length]
        sequences.append(sequence)
    
    return sequences


def save_sample_data(landmarks: List[Dict], label: int, letter: Optional[str] = None,
                     output_path: str = 'sample_data.json'):
    """
    Save a sample to a JSON file (for creating training datasets).
    
    Args:
        landmarks: List of 21 landmarks
        label: Integer label (0-25 for A-Z)
        letter: Optional letter name (e.g., 'A')
        output_path: Path to save the JSON file
    """
    # Load existing data if file exists
    try:
        with open(output_path, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {'samples': []}
    
    # Add new sample
    sample = {
        'landmarks': landmarks,
        'label': label,
    }
    if letter:
        sample['letter'] = letter
    
    data['samples'].append(sample)
    
    # Save updated data
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"Saved sample to {output_path} (total samples: {len(data['samples'])})")


def create_class_names_file(num_classes: int = 26, output_path: str = 'class_names.json'):
    """
    Create a JSON file with class names (A-Z by default).
    
    Args:
        num_classes: Number of classes
        output_path: Path to save the JSON file
    """
    if num_classes <= 26:
        class_names = [chr(ord('A') + i) for i in range(num_classes)]
    else:
        class_names = [chr(ord('A') + i) for i in range(26)]
        class_names.extend([f"Class_{i}" for i in range(26, num_classes)])
    
    with open(output_path, 'w') as f:
        json.dump(class_names, f, indent=2)
    
    print(f"Created class names file: {output_path}")
    return class_names


def validate_landmarks(landmarks: List[Dict]) -> bool:
    """
    Validate that landmarks have the correct structure.
    
    Args:
        landmarks: List of landmarks to validate
    
    Returns:
        True if valid, raises ValueError if not
    """
    if not isinstance(landmarks, list):
        raise ValueError("Landmarks must be a list")
    
    if len(landmarks) != 21:
        raise ValueError(f"Expected 21 landmarks, got {len(landmarks)}")
    
    for i, landmark in enumerate(landmarks):
        if not isinstance(landmark, dict):
            raise ValueError(f"Landmark {i} must be a dictionary")
        
        if 'x' not in landmark or 'y' not in landmark:
            raise ValueError(f"Landmark {i} must have 'x' and 'y' keys")
        
        if not isinstance(landmark['x'], (int, float)) or not isinstance(landmark['y'], (int, float)):
            raise ValueError(f"Landmark {i} x and y must be numbers")
    
    return True


if __name__ == "__main__":
    # Example usage
    example_landmarks = [
        {'x': 0.050533443689346313, 'y': 0.4781053364276886, 'z': 8.521406584804936e-7},
        {'x': 0.1137983649969101, 'y': 0.5323284268379211, 'z': -0.059269919991493225},
        # ... (would include all 21 landmarks)
    ]
    
    # Validate
    try:
        validate_landmarks(example_landmarks)
        print("Landmarks are valid!")
    except ValueError as e:
        print(f"Validation error: {e}")
    
    # Convert to features
    features = landmarks_to_features(example_landmarks)
    print(f"Feature vector shape: {features.shape}")
    
    # Normalize
    normalized = normalize_landmarks(example_landmarks, method='relative')
    print(f"Normalized landmarks: {len(normalized)} landmarks")


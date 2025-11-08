"""
Inference script for ASL LSTM model.
"""

import torch
import json
import argparse
from pathlib import Path
from asl_model import create_model


def load_model(model_path, device='cpu'):
    """
    Load a trained ASL model from checkpoint.
    
    Args:
        model_path: Path to model checkpoint (.pth file)
        device: Device to load model on
    
    Returns:
        Loaded model
    """
    checkpoint = torch.load(model_path, map_location=device)
    
    # Get model parameters from checkpoint
    num_classes = checkpoint.get('num_classes', 26)
    hidden_size = checkpoint.get('hidden_size', 128)
    num_layers = checkpoint.get('num_layers', 2)
    
    # Create model
    model = create_model(
        num_classes=num_classes,
        hidden_size=hidden_size,
        num_layers=num_layers,
    )
    
    # Load weights
    model.load_state_dict(checkpoint['model_state_dict'])
    model.eval()
    model = model.to(device)
    
    return model


def predict_from_landmarks(model, landmarks, device='cpu', class_names=None):
    """
    Predict ASL sign from hand landmarks.
    
    Args:
        model: Trained ASL model
        landmarks: List of 21 landmarks with x, y, z coordinates
        device: Device to run inference on
        class_names: Optional list of class names (e.g., ['A', 'B', 'C', ...])
    
    Returns:
        Dictionary with prediction results
    """
    result = model.predict(landmarks, device=device)
    
    # Add class name if available
    if class_names and result['prediction'] < len(class_names):
        result['class_name'] = class_names[result['prediction']]
    else:
        # Default: map to letters A-Z
        result['class_name'] = chr(ord('A') + result['prediction']) if result['prediction'] < 26 else f"Class_{result['prediction']}"
    
    return result


def predict_from_file(model_path, input_path, device='cpu', class_names=None):
    """
    Predict from a JSON file containing landmarks.
    
    Expected input format:
    {
        "landmarks": [{"x": float, "y": float, "z": float}, ...]  # 21 landmarks
    }
    or for batch:
    {
        "samples": [
            {"landmarks": [...], ...},
            ...
        ]
    }
    """
    # Load model
    model = load_model(model_path, device=device)
    
    # Load input data
    with open(input_path, 'r') as f:
        data = json.load(f)
    
    # Handle single sample or batch
    if 'landmarks' in data:
        # Single sample
        landmarks = data['landmarks']
        result = predict_from_landmarks(model, landmarks, device, class_names)
        return result
    elif 'samples' in data:
        # Batch of samples
        results = []
        for sample in data['samples']:
            landmarks = sample['landmarks']
            result = predict_from_landmarks(model, landmarks, device, class_names)
            results.append(result)
        return results
    else:
        raise ValueError("Input file must contain 'landmarks' or 'samples' key")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Predict ASL sign from hand landmarks')
    parser.add_argument('--model', type=str, required=True,
                        help='Path to trained model checkpoint (.pth file)')
    parser.add_argument('--input', type=str, required=True,
                        help='Path to input JSON file with landmarks')
    parser.add_argument('--device', type=str, default='cpu',
                        help='Device to use (cpu or cuda, default: cpu)')
    parser.add_argument('--class_names', type=str, default=None,
                        help='Path to JSON file with class names list (optional)')
    parser.add_argument('--output', type=str, default=None,
                        help='Path to save prediction results (optional)')
    
    args = parser.parse_args()
    
    # Load class names if provided
    class_names = None
    if args.class_names:
        with open(args.class_names, 'r') as f:
            class_names = json.load(f)
    
    # Check if CUDA is available
    if args.device == 'cuda' and not torch.cuda.is_available():
        print("CUDA not available, using CPU instead")
        args.device = 'cpu'
    
    # Make prediction
    try:
        results = predict_from_file(args.model, args.input, args.device, class_names)
        
        # Print results
        if isinstance(results, list):
            # Batch results
            print(f"\nPredictions for {len(results)} samples:")
            for i, result in enumerate(results):
                print(f"\nSample {i+1}:")
                print(f"  Prediction: {result['class_name']} (class {result['prediction']})")
                print(f"  Confidence: {result['confidence']:.4f}")
                print(f"  Top 3 predictions:")
                top3 = sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)[:3]
                for class_idx, prob in top3:
                    class_name = class_names[class_idx] if class_names and class_idx < len(class_names) else chr(ord('A') + class_idx)
                    print(f"    {class_name}: {prob:.4f}")
        else:
            # Single result
            print(f"\nPrediction: {results['class_name']} (class {results['prediction']})")
            print(f"Confidence: {results['confidence']:.4f}")
            print(f"\nTop 5 predictions:")
            top5 = sorted(results['probabilities'].items(), key=lambda x: x[1], reverse=True)[:5]
            for class_idx, prob in top5:
                class_name = class_names[class_idx] if class_names and class_idx < len(class_names) else chr(ord('A') + class_idx)
                print(f"  {class_name}: {prob:.4f}")
        
        # Save results if output path provided
        if args.output:
            with open(args.output, 'w') as f:
                json.dump(results, f, indent=2)
            print(f"\nResults saved to {args.output}")
    
    except Exception as e:
        print(f"Error during prediction: {e}")
        raise


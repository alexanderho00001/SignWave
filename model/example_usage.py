"""
Example usage of the ASL LSTM model.

This script demonstrates how to use the model for prediction.
Run this after installing dependencies: pip install torch numpy
"""

from asl_model import create_model
from utils import validate_landmarks, normalize_landmarks

# Example hand landmarks (21 landmarks with x, y, z coordinates)
example_landmarks = [
    {'x': 0.050533443689346313, 'y': 0.4781053364276886, 'z': 8.521406584804936e-7},
    {'x': 0.1137983649969101, 'y': 0.5323284268379211, 'z': -0.059269919991493225},
    {'x': 0.21011054515838623, 'y': 0.5440336465835571, 'z': -0.07492084056138992},
    {'x': 0.2740953266620636, 'y': 0.4709554612636566, 'z': -0.08454474806785583},
    {'x': 0.3119952082633972, 'y': 0.38830751180648804, 'z': -0.09159215539693832},
    {'x': 0.3080276846885681, 'y': 0.4714696407318115, 'z': -0.02511206641793251},
    {'x': 0.40463799238204956, 'y': 0.45416465401649475, 'z': -0.042023491114377975},
    {'x': 0.4616929590702057, 'y': 0.4334956407546997, 'z': -0.05856558308005333},
    {'x': 0.5156193971633911, 'y': 0.4118529260158539, 'z': -0.0730094239115715},
    {'x': 0.30049678683280945, 'y': 0.4025536775588989, 'z': -0.017125902697443962},
    {'x': 0.40444353222846985, 'y': 0.38330668210983276, 'z': -0.03333813697099686},
    {'x': 0.4709787964820862, 'y': 0.3691039979457855, 'z': -0.05482639744877815},
    {'x': 0.5268370509147644, 'y': 0.3561404347419739, 'z': -0.07302939146757126},
    {'x': 0.2680824100971222, 'y': 0.343975692987442, 'z': -0.017435122281312943},
    {'x': 0.3536880910396576, 'y': 0.31085413694381714, 'z': -0.056128181517124176},
    {'x': 0.3603805899620056, 'y': 0.30522510409355164, 'z': -0.08603894710540771},
    {'x': 0.3537669777870178, 'y': 0.2993718087673187, 'z': -0.10162945091724396},
    {'x': 0.22228436172008514, 'y': 0.28732001781463623, 'z': -0.022320087999105453},
    {'x': 0.28770363330841064, 'y': 0.24922703206539154, 'z': -0.06651794165372849},
    {'x': 0.28103166818618774, 'y': 0.26306360960006714, 'z': -0.08715596050024033},
    {'x': 0.2575681805610657, 'y': 0.28086763620376587, 'z': -0.0975690707564354},
]


def main():
    print("ASL LSTM Model - Example Usage\n")
    
    # Validate landmarks
    try:
        validate_landmarks(example_landmarks)
        print("✓ Landmarks validated (21 landmarks found)")
    except ValueError as e:
        print(f"✗ Validation error: {e}")
        return
    
    # Create model
    print("\nCreating model...")
    model = create_model(
        num_classes=26,      # 26 letters A-Z
        hidden_size=128,
        num_layers=2,
        dropout=0.3,
        bidirectional=True
    )
    print("✓ Model created successfully")
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Total parameters: {total_params:,}")
    print(f"  Trainable parameters: {trainable_params:,}")
    
    # Make prediction (note: model is untrained, so predictions are random)
    print("\nMaking prediction...")
    print("(Note: Model is untrained, so predictions are random)")
    
    result = model.predict(example_landmarks, device='cpu')
    
    # Map prediction to letter
    predicted_letter = chr(ord('A') + result['prediction'])
    
    print(f"\nPrediction Results:")
    print(f"  Predicted letter: {predicted_letter} (class {result['prediction']})")
    print(f"  Confidence: {result['confidence']:.4f}")
    
    # Show top 5 predictions
    print(f"\nTop 5 predictions:")
    top5 = sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)[:5]
    for class_idx, prob in top5:
        letter = chr(ord('A') + class_idx)
        print(f"  {letter}: {prob:.4f}")
    
    # Optional: Normalize landmarks
    print("\n\nNormalizing landmarks (relative to wrist)...")
    normalized = normalize_landmarks(example_landmarks, method='relative')
    print("✓ Landmarks normalized")
    
    print("\nExample usage completed!")


if __name__ == "__main__":
    main()


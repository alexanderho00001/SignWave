# ASL LSTM Model

This directory contains a neural network model for interpreting American Sign Language (ASL) from hand landmark data.

## Model Architecture

The model uses an LSTM (Long Short-Term Memory) architecture to process hand landmark sequences:

- **Input**: 21 hand landmarks × 3 coordinates (x, y, z) = 63 features
- **Architecture**: 
  - Bidirectional LSTM layers (default: 2 layers, 128 hidden units)
  - Fully connected layers with dropout
  - Output: Probability distribution over ASL letters/signs (default: 26 classes for A-Z)

## Files

- `asl_model.py`: Model architecture definition (`ASLLSTMModel` class)
- `train.py`: Training script for the model
- `predict.py`: Inference script for making predictions
- `utils.py`: Utility functions for data preprocessing and validation
- `__init__.py`: Package initialization

## Installation

Install required dependencies:

```bash
pip install torch numpy
```

Or install all project requirements:

```bash
pip install -r ../requirements.txt
```

## Usage

### Model Definition

```python
from model.asl_model import create_model

# Create a model
model = create_model(
    num_classes=26,      # Number of ASL signs (default: 26 for A-Z)
    hidden_size=128,     # LSTM hidden size
    num_layers=2,        # Number of LSTM layers
    dropout=0.3,         # Dropout rate
    bidirectional=True   # Use bidirectional LSTM
)
```

### Making Predictions

```python
from model.asl_model import create_model

# Create or load model
model = create_model(num_classes=26)

# Example landmarks (21 landmarks with x, y, z coordinates)
landmarks = [
    {'x': 0.0505, 'y': 0.4781, 'z': 0.0000},
    {'x': 0.1138, 'y': 0.5323, 'z': -0.0593},
    # ... (21 total landmarks)
]

# Make prediction
result = model.predict(landmarks)
print(f"Predicted: {result['prediction']}")  # Class index
print(f"Confidence: {result['confidence']}")  # Confidence score
print(f"Probabilities: {result['probabilities']}")  # All class probabilities
```

### Training

1. **Prepare training data** in JSON format:

```json
{
  "samples": [
    {
      "landmarks": [
        {"x": 0.0505, "y": 0.4781, "z": 0.0000},
        {"x": 0.1138, "y": 0.5323, "z": -0.0593},
        ...
      ],
      "label": 0,
      "letter": "A"
    },
    ...
  ]
}
```

2. **Train the model**:

```bash
python model/train.py \
    --train_data data/train.json \
    --val_data data/val.json \
    --num_classes 26 \
    --hidden_size 128 \
    --num_layers 2 \
    --batch_size 32 \
    --learning_rate 0.001 \
    --num_epochs 50 \
    --device cpu \
    --save_path model/asl_model.pth
```

### Inference

```bash
python model/predict.py \
    --model model/asl_model.pth \
    --input data/test_sample.json \
    --device cpu \
    --output predictions.json
```

Input JSON format:
```json
{
  "landmarks": [
    {"x": 0.0505, "y": 0.4781, "z": 0.0000},
    {"x": 0.1138, "y": 0.5323, "z": -0.0593},
    ...
  ]
}
```

Or for batch prediction:
```json
{
  "samples": [
    {"landmarks": [...]},
    {"landmarks": [...]},
    ...
  ]
}
```

## Data Format

The model expects hand landmarks in the following format:

- **21 landmarks** per hand (MediaPipe hand landmarks)
- Each landmark has **x, y, z coordinates** (normalized 0-1 for x, y)
- Input shape: `(batch_size, sequence_length, 63)` where 63 = 21 landmarks × 3 coordinates

## Integration with Backend

To integrate with the Django backend, you can create an API endpoint:

```python
from model.asl_model import create_model
from model.predict import load_model

# Load model once at startup
model = load_model('model/asl_model.pth', device='cpu')

@api_view(['POST'])
def predict_asl(request):
    landmarks = request.data.get('landmarks')
    result = model.predict(landmarks)
    return Response(result)
```

## Model Parameters

- **input_size**: 63 (21 landmarks × 3 coordinates)
- **hidden_size**: 128 (configurable)
- **num_layers**: 2 (configurable)
- **num_classes**: 26 (A-Z, configurable)
- **dropout**: 0.3 (configurable)
- **bidirectional**: True (configurable)

## Notes

- The model can process single frames or sequences of frames
- For single frame input, the sequence length is 1
- For better accuracy, consider using sequences of frames (e.g., 5-10 frames)
- Normalization of landmarks can improve performance (see `utils.py`)


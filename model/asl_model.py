"""
LSTM-based ASL (American Sign Language) interpretation model.

This model takes hand landmark data (21 landmarks with x, y, z coordinates)
and predicts the corresponding ASL letter or sign.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ASLLSTMModel(nn.Module):
    """
    LSTM-based model for ASL sign recognition.
    
    Input: Hand landmarks (21 points * 3 coordinates = 63 features)
    Output: Probability distribution over ASL letters/signs
    """
    
    def __init__(
        self,
        input_size: int = 63,  # 21 landmarks × 3 coordinates (x, y, z)
        hidden_size: int = 128,
        num_layers: int = 2,
        num_classes: int = 26,  # 26 letters A-Z (can be extended for words/phrases)
        dropout: float = 0.3,
        bidirectional: bool = True,
    ):
        """
        Initialize the ASL LSTM model.
        
        Args:
            input_size: Number of input features (default: 63 for 21 landmarks × 3 coords)
            hidden_size: Number of hidden units in LSTM layers
            num_layers: Number of LSTM layers
            num_classes: Number of output classes (ASL letters/signs)
            dropout: Dropout probability
            bidirectional: Whether to use bidirectional LSTM
        """
        super(ASLLSTMModel, self).__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.num_classes = num_classes
        self.bidirectional = bidirectional
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional,
            batch_first=True,
        )
        
        # Calculate LSTM output size (doubled if bidirectional)
        lstm_output_size = hidden_size * 2 if bidirectional else hidden_size
        
        # Fully connected layers
        self.fc1 = nn.Linear(lstm_output_size, 256)
        self.dropout1 = nn.Dropout(dropout)
        self.fc2 = nn.Linear(256, 128)
        self.dropout2 = nn.Dropout(dropout)
        self.fc3 = nn.Linear(128, num_classes)
        
    def forward(self, x):
        """
        Forward pass through the model.
        
        Args:
            x: Input tensor of shape (batch_size, sequence_length, input_size)
               or (batch_size, input_size) for single frame
        
        Returns:
            Output tensor of shape (batch_size, num_classes) with logits
        """
        # Handle single frame input (add sequence dimension)
        if len(x.shape) == 2:
            x = x.unsqueeze(1)  # (batch_size, 1, input_size)
        
        # LSTM forward pass
        lstm_out, (h_n, c_n) = self.lstm(x)
        
        # Use the last output from the sequence
        # lstm_out shape: (batch_size, seq_len, hidden_size * num_directions)
        last_output = lstm_out[:, -1, :]  # (batch_size, hidden_size * num_directions)
        
        # Fully connected layers
        x = F.relu(self.fc1(last_output))
        x = self.dropout1(x)
        x = F.relu(self.fc2(x))
        x = self.dropout2(x)
        x = self.fc3(x)
        
        return x
    
    def predict(self, landmarks, device='cpu'):
        """
        Make a prediction from hand landmarks.
        
        Args:
            landmarks: List of 21 landmarks, each with x, y, z coordinates
                      Format: [{'x': float, 'y': float, 'z': float}, ...]
                      or numpy array of shape (21, 3) or (63,)
            device: Device to run inference on ('cpu' or 'cuda')
        
        Returns:
            Dictionary with:
                - 'prediction': Predicted class index
                - 'probabilities': Dictionary mapping class indices to probabilities
                - 'confidence': Confidence score (max probability)
        """
        self.eval()
        
        # Convert landmarks to tensor
        if isinstance(landmarks, list):
            # Flatten landmarks: [{'x': 0.1, 'y': 0.2, 'z': 0.3}, ...] -> [0.1, 0.2, 0.3, ...]
            features = []
            for landmark in landmarks:
                features.extend([landmark['x'], landmark['y'], landmark['z']])
            tensor_input = torch.tensor(features, dtype=torch.float32)
        else:
            # Assume numpy array or tensor
            tensor_input = torch.tensor(landmarks, dtype=torch.float32)
            if tensor_input.shape == (21, 3):
                tensor_input = tensor_input.flatten()
        
        # Ensure correct shape: (1, 63) for batch_size=1, input_size=63
        if tensor_input.shape == (63,):
            tensor_input = tensor_input.unsqueeze(0)  # (1, 63)
        elif tensor_input.shape == (1, 63):
            pass  # Already correct
        else:
            raise ValueError(f"Unexpected input shape: {tensor_input.shape}. Expected (63,) or (1, 63)")
        
        # Move to device
        tensor_input = tensor_input.to(device)
        self.to(device)
        
        # Forward pass
        with torch.no_grad():
            logits = self.forward(tensor_input)
            probabilities = F.softmax(logits, dim=1)
        
        # Get prediction
        probs = probabilities[0].cpu().numpy()
        prediction_idx = int(torch.argmax(probabilities, dim=1).item())
        confidence = float(probs[prediction_idx])
        
        # Create probabilities dictionary
        prob_dict = {i: float(probs[i]) for i in range(len(probs))}
        
        return {
            'prediction': prediction_idx,
            'probabilities': prob_dict,
            'confidence': confidence,
        }


def create_model(num_classes=26, **kwargs):
    """
    Factory function to create an ASL LSTM model.
    
    Args:
        num_classes: Number of output classes
        **kwargs: Additional arguments passed to ASLLSTMModel
    
    Returns:
        Initialized ASLLSTMModel instance
    """
    return ASLLSTMModel(num_classes=num_classes, **kwargs)


if __name__ == "__main__":
    # Example usage and model testing
    print("Creating ASL LSTM model...")
    model = create_model(num_classes=26, hidden_size=128, num_layers=2)
    
    # Test with example input (single frame)
    print("\nTesting with single frame input...")
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
    
    result = model.predict(example_landmarks)
    print(f"Prediction: {result['prediction']}")
    print(f"Confidence: {result['confidence']:.4f}")
    print(f"Top 5 probabilities: {sorted(result['probabilities'].items(), key=lambda x: x[1], reverse=True)[:5]}")
    
    # Test with sequence input
    print("\nTesting with sequence input...")
    batch_size = 2
    seq_length = 5
    input_size = 63
    sequence_input = torch.randn(batch_size, seq_length, input_size)
    output = model(sequence_input)
    print(f"Input shape: {sequence_input.shape}")
    print(f"Output shape: {output.shape}")
    
    print("\nModel created successfully!")


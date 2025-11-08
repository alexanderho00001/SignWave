"""
Training script for ASL LSTM model.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
import json
import os
from pathlib import Path
from asl_model import ASLLSTMModel, create_model


class ASLDataset(Dataset):
    """
    Dataset for ASL hand landmark data.
    
    Expected data format:
    {
        "samples": [
            {
                "landmarks": [{"x": float, "y": float, "z": float}, ...],  # 21 landmarks
                "label": int,  # Class label (0-25 for A-Z)
                "letter": str  # Optional: letter name (e.g., "A")
            },
            ...
        ]
    }
    """
    
    def __init__(self, data_path, sequence_length=1):
        """
        Initialize dataset.
        
        Args:
            data_path: Path to JSON file containing training data
            sequence_length: Number of frames to use as sequence (default: 1 for single frame)
        """
        self.sequence_length = sequence_length
        
        # Load data
        with open(data_path, 'r') as f:
            data = json.load(f)
        
        self.samples = data.get('samples', [])
        
        # Convert landmarks to feature vectors
        self.features = []
        self.labels = []
        
        for sample in self.samples:
            landmarks = sample['landmarks']
            # Flatten landmarks: 21 landmarks × 3 coords = 63 features
            feature_vector = []
            for landmark in landmarks:
                feature_vector.extend([landmark['x'], landmark['y'], landmark['z']])
            
            self.features.append(feature_vector)
            self.labels.append(sample['label'])
        
        self.features = np.array(self.features, dtype=np.float32)
        self.labels = np.array(self.labels, dtype=np.int64)
        
        print(f"Loaded {len(self.samples)} samples")
        print(f"Feature shape: {self.features.shape}")
        print(f"Number of classes: {len(np.unique(self.labels))}")
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        """
        Get a sample from the dataset.
        
        Returns:
            features: Tensor of shape (sequence_length, 63)
            label: Integer label
        """
        features = torch.tensor(self.features[idx], dtype=torch.float32)
        
        # Reshape for sequence: (63,) -> (1, 63) -> (sequence_length, 63)
        if self.sequence_length > 1:
            # For sequence data, repeat the frame or use sliding window
            features = features.unsqueeze(0).repeat(self.sequence_length, 1)
        else:
            features = features.unsqueeze(0)  # (1, 63)
        
        label = torch.tensor(self.labels[idx], dtype=torch.long)
        
        return features, label


def train_model(
    train_data_path,
    val_data_path=None,
    num_classes=26,
    hidden_size=128,
    num_layers=2,
    batch_size=32,
    learning_rate=0.001,
    num_epochs=50,
    device='cpu',
    save_path='model/asl_model.pth',
    sequence_length=1,
):
    """
    Train the ASL LSTM model.
    
    Args:
        train_data_path: Path to training data JSON file
        val_data_path: Optional path to validation data JSON file
        num_classes: Number of output classes
        hidden_size: LSTM hidden size
        num_layers: Number of LSTM layers
        batch_size: Batch size for training
        learning_rate: Learning rate
        num_epochs: Number of training epochs
        device: Device to train on ('cpu' or 'cuda')
        save_path: Path to save the trained model
        sequence_length: Sequence length for LSTM input
    """
    # Create model
    model = create_model(
        num_classes=num_classes,
        hidden_size=hidden_size,
        num_layers=num_layers,
    )
    model = model.to(device)
    
    # Loss and optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=5, verbose=True
    )
    
    # Load datasets
    train_dataset = ASLDataset(train_data_path, sequence_length=sequence_length)
    train_loader = DataLoader(
        train_dataset, batch_size=batch_size, shuffle=True, num_workers=0
    )
    
    val_loader = None
    if val_data_path and os.path.exists(val_data_path):
        val_dataset = ASLDataset(val_data_path, sequence_length=sequence_length)
        val_loader = DataLoader(
            val_dataset, batch_size=batch_size, shuffle=False, num_workers=0
        )
    
    # Training loop
    best_val_loss = float('inf')
    
    for epoch in range(num_epochs):
        # Training phase
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0
        
        for features, labels in train_loader:
            features = features.to(device)
            labels = labels.to(device)
            
            # Forward pass
            optimizer.zero_grad()
            outputs = model(features)
            loss = criterion(outputs, labels)
            
            # Backward pass
            loss.backward()
            optimizer.step()
            
            # Statistics
            train_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            train_total += labels.size(0)
            train_correct += (predicted == labels).sum().item()
        
        train_loss /= len(train_loader)
        train_acc = 100 * train_correct / train_total
        
        # Validation phase
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        
        if val_loader:
            model.eval()
            with torch.no_grad():
                for features, labels in val_loader:
                    features = features.to(device)
                    labels = labels.to(device)
                    
                    outputs = model(features)
                    loss = criterion(outputs, labels)
                    
                    val_loss += loss.item()
                    _, predicted = torch.max(outputs.data, 1)
                    val_total += labels.size(0)
                    val_correct += (predicted == labels).sum().item()
            
            val_loss /= len(val_loader)
            val_acc = 100 * val_correct / val_total
            scheduler.step(val_loss)
            
            # Save best model
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                torch.save({
                    'epoch': epoch,
                    'model_state_dict': model.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'loss': val_loss,
                    'num_classes': num_classes,
                    'hidden_size': hidden_size,
                    'num_layers': num_layers,
                }, save_path)
                print(f"Saved best model (val_loss: {val_loss:.4f})")
        
        # Print progress
        if val_loader:
            print(
                f"Epoch [{epoch+1}/{num_epochs}] | "
                f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}% | "
                f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%"
            )
        else:
            print(
                f"Epoch [{epoch+1}/{num_epochs}] | "
                f"Train Loss: {train_loss:.4f}, Train Acc: {train_acc:.2f}%"
            )
    
    # Save final model if no validation set
    if not val_loader:
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        torch.save({
            'epoch': num_epochs,
            'model_state_dict': model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'loss': train_loss,
            'num_classes': num_classes,
            'hidden_size': hidden_size,
            'num_layers': num_layers,
        }, save_path)
        print(f"Saved final model to {save_path}")
    
    print("Training completed!")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Train ASL LSTM Model')
    parser.add_argument('--train_data', type=str, required=True,
                        help='Path to training data JSON file')
    parser.add_argument('--val_data', type=str, default=None,
                        help='Path to validation data JSON file (optional)')
    parser.add_argument('--num_classes', type=int, default=26,
                        help='Number of output classes (default: 26 for A-Z)')
    parser.add_argument('--hidden_size', type=int, default=128,
                        help='LSTM hidden size (default: 128)')
    parser.add_argument('--num_layers', type=int, default=2,
                        help='Number of LSTM layers (default: 2)')
    parser.add_argument('--batch_size', type=int, default=32,
                        help='Batch size (default: 32)')
    parser.add_argument('--learning_rate', type=float, default=0.001,
                        help='Learning rate (default: 0.001)')
    parser.add_argument('--num_epochs', type=int, default=50,
                        help='Number of epochs (default: 50)')
    parser.add_argument('--device', type=str, default='cpu',
                        help='Device to use (cpu or cuda, default: cpu)')
    parser.add_argument('--save_path', type=str, default='model/asl_model.pth',
                        help='Path to save trained model')
    parser.add_argument('--sequence_length', type=int, default=1,
                        help='Sequence length for LSTM input (default: 1)')
    
    args = parser.parse_args()
    
    # Check if CUDA is available
    if args.device == 'cuda' and not torch.cuda.is_available():
        print("CUDA not available, using CPU instead")
        args.device = 'cpu'
    
    train_model(
        train_data_path=args.train_data,
        val_data_path=args.val_data,
        num_classes=args.num_classes,
        hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        num_epochs=args.num_epochs,
        device=args.device,
        save_path=args.save_path,
        sequence_length=args.sequence_length,
    )


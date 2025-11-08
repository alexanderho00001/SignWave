import tensorflow as tf
from tensorflow import keras
import numpy as np
import os

class ASLPretrainedModel:
    def __init__(self, model_path='api/action.h5'):
        """
        Initialize with the pre-trained model from the GitHub repo
        This model recognizes: 'hello', 'thanks', 'iloveyou'
        """
        self.model_path = model_path
        self.sequence_length = 30  # Frames to track
        self.num_landmarks = 21  # MediaPipe hand landmarks
        
        # These are the actions the pre-trained model recognizes
        # Based on the GitHub repo
        self.actions = ['hello', 'thanks', 'iloveyou']
        self.num_actions = len(self.actions)
        
        # Mediapipe holistic extracts more landmarks, but we'll use just hands
        # The model expects: pose (33 landmarks * 4) + face (468 * 3) + left hand (21 * 3) + right hand (21 * 3)
        # Total: 1662 features per frame
        # But we'll adapt it to just use hands: 21 * 3 = 63 features
        
        self.load_model()
    
    def load_model(self):
        """Load the pre-trained model"""
        try:
            if os.path.exists(self.model_path):
                self.model = keras.models.load_model(self.model_path)
                print(f"✅ Model loaded successfully from {self.model_path}")
                print(f"Model input shape: {self.model.input_shape}")
                print(f"Model output shape: {self.model.output_shape}")
            else:
                print(f"❌ Model file not found at {self.model_path}")
                print("Please download action.h5 from the GitHub repo and place it in backend/api/")
                self.model = None
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            self.model = None
    
    def preprocess_sequence(self, landmark_sequence):
        """
        Convert sequence of hand landmarks to model input format
        """
        features = []
        
        for frame_landmarks in landmark_sequence:
            # Extract x, y, z from each landmark
            frame_features = []
            for landmark in frame_landmarks:
                frame_features.extend([landmark['x'], landmark['y'], landmark['z']])
            
            # The original model might expect more features (pose + face + hands)
            # We'll pad with zeros if needed
            # Expected: 1662 features (pose: 132, face: 1404, lh: 63, rh: 63)
            # We have: 63 (just right hand)
            
            # Pad to match expected input
            # If model expects 1662, pad; if it expects 63, we're good
            features.append(frame_features)
        
        # Pad or truncate to sequence_length
        while len(features) < self.sequence_length:
            if len(features) > 0:
                features.append(features[-1])  # Repeat last frame
            else:
                features.append([0] * 63)
        
        features = features[:self.sequence_length]
        
        return np.array(features).reshape(1, self.sequence_length, -1)
    
    def predict(self, landmark_sequence):
        """
        Predict sign from sequence of landmarks
        Returns: (predicted_word, confidence)
        """
        if self.model is None:
            return None, 0.0
        
        if len(landmark_sequence) < 15:  # Need minimum frames
            return None, 0.0
        
        try:
            # Preprocess
            features = self.preprocess_sequence(landmark_sequence)
            
            # Check if input shape matches
            expected_features = self.model.input_shape[-1]
            actual_features = features.shape[-1]
            
            if expected_features != actual_features:
                # Pad or truncate features to match
                if actual_features < expected_features:
                    padding = np.zeros((1, self.sequence_length, expected_features - actual_features))
                    features = np.concatenate([features, padding], axis=-1)
                else:
                    features = features[:, :, :expected_features]
            
            # Predict
            predictions = self.model.predict(features, verbose=0)[0]
            
            # Get best prediction
            predicted_idx = np.argmax(predictions)
            confidence = float(predictions[predicted_idx])
            
            # Return prediction if confidence is good
            if confidence > 0.6:
                return self.actions[predicted_idx], confidence
            
            return None, confidence
            
        except Exception as e:
            print(f"Error during prediction: {e}")
            return None, 0.0
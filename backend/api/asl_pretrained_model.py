import os
import json
import numpy as np
import tensorflow as tf
from tensorflow import keras


class ASLPretrainedModel:
    """
    Wrapper around 209sontung/sign-language Transformer model.

    - Loads a pre-trained .h5 from the repo's `models/` directory.
    - Loads label mapping from `sign_to_prediction_index_map.json`.
    - Adapts your MediaPipe hand landmark sequences to the model's
      expected (sequence_length, feature_dim) shape by padding/truncating.
    """

    def __init__(
        self,
        model_path='api/pretrained/islr-fp16-192-8-seed_all42-foldall-last.h5',
        label_map_path='api/pretrained/sign_to_prediction_index_map.json',
    ):
        self.model_path = model_path
        self.label_map_path = label_map_path

        # This is just a default when model hasn't loaded yet.
        # Will be overwritten after load_model() based on model.input_shape.
        self.sequence_length = 30
        self.feature_dim = 63  # 21 landmarks * (x,y,z)

        self.actions = []
        self.idx_to_sign = {}
        self.sign_to_idx = {}
        self.num_actions = 0

        self.model = None
        self.load_model()

    def load_model(self):
        """Load the pre-trained Transformer model + label map from disk."""
        try:
            if not os.path.exists(self.model_path):
                print(f"❌ Model file not found at {self.model_path}")
                print("   Make sure you downloaded the .h5 from the GitHub repo.")
                return

            # If this model uses only built-in Keras layers, this is enough.
            # If you get an 'Unknown layer' error, you'll need to add the
            # corresponding custom_objects here (e.g., from backbone.py).
            self.model = keras.models.load_model(self.model_path, compile=False)
            print(f"✅ Model loaded successfully from {self.model_path}")
            print(f"   Model input shape: {self.model.input_shape}")
            print(f"   Model output shape: {self.model.output_shape}")

            # Infer sequence length & feature dim from the model
            # Expecting something like (None, T, D)
            if len(self.model.input_shape) == 3:
                _, T, D = self.model.input_shape
                self.sequence_length = int(T)
                self.feature_dim = int(D)
            else:
                print("⚠️ Unexpected input shape; keeping default sequence_length=30, feature_dim=63")

            # Load label mapping
            self._load_label_map()

        except Exception as e:
            print(f"❌ Error loading model: {e}")
            self.model = None

    def _load_label_map(self):
        """Load sign <-> index mapping from the JSON file."""
        if not os.path.exists(self.label_map_path):
            print(f"⚠️ Label map not found at {self.label_map_path}")
            return

        try:
            with open(self.label_map_path, 'r', encoding='utf-8') as f:
                mapping = json.load(f)

            # Try to detect mapping direction.
            # Most Kaggle/competition repos use {sign: index}.
            sample_key = next(iter(mapping.keys()))
            if isinstance(sample_key, str) and not sample_key.isdigit():
                # sign -> index
                self.sign_to_idx = {k: int(v) for k, v in mapping.items()}
                self.idx_to_sign = {v: k for k, v in self.sign_to_idx.items()}
            else:
                # index -> sign
                self.idx_to_sign = {int(k): v for k, v in mapping.items()}
                self.sign_to_idx = {v: k for k, v in self.idx_to_sign.items()}

            self.actions = [self.idx_to_sign[i] for i in sorted(self.idx_to_sign.keys())]
            self.num_actions = len(self.actions)

            print(f"✅ Loaded {self.num_actions} signs from label map")
        except Exception as e:
            print(f"⚠️ Error loading label map: {e}")

    def _flatten_hand_landmarks(self, frame_landmarks):
        """
        Convert a list of 21 landmarks with keys x,y,z into a flat feature vector.
        Your view is already giving you `landmark['x'],['y'],['z']` in [0,1] coords.
        """
        frame_features = []
        for lm in frame_landmarks:
            frame_features.extend([lm['x'], lm['y'], lm['z']])
        return frame_features  # length 63

    def preprocess_sequence(self, landmark_sequence):
        """
        Convert a sequence of hand landmarks to (1, sequence_length, feature_dim)
        by:
          - flattening (21 * 3 = 63) per frame,
          - padding/truncating time dimension to model.sequence_length,
          - padding/truncating feature dimension to model.feature_dim.
        """
        if not landmark_sequence:
            # No frames at all; just return zeros
            features = np.zeros((self.sequence_length, self.feature_dim), dtype=np.float32)
            return features[np.newaxis, ...]

        # 1) Build frame-wise features (T_raw, 63)
        frames = [self._flatten_hand_landmarks(f) for f in landmark_sequence]
        frames = np.array(frames, dtype=np.float32)

        # 2) Pad/truncate time dimension to self.sequence_length
        T_raw, D_raw = frames.shape
        T_target = self.sequence_length
        D_target = self.feature_dim

        if T_raw >= T_target:
            frames = frames[-T_target:]  # keep the most recent frames
        else:
            # Pad by repeating last frame
            last = frames[-1]
            pad_count = T_target - T_raw
            pad_block = np.repeat(last[np.newaxis, :], pad_count, axis=0)
            frames = np.concatenate([frames, pad_block], axis=0)

        # 3) Pad/truncate feature dimension to D_target
        if D_raw == D_target:
            pass  # nothing to do
        elif D_raw < D_target:
            pad_width = D_target - D_raw
            pad_block = np.zeros((T_target, pad_width), dtype=np.float32)
            frames = np.concatenate([frames, pad_block], axis=1)
        else:
            # Too many features; keep the first D_target (we only have 63 anyway)
            frames = frames[:, :D_target]

        # Final shape: (1, sequence_length, feature_dim)
        return frames[np.newaxis, :, :]

    def predict(self, landmark_sequence, min_frames=None, threshold=0.6):
        """
        Predict sign from a sequence of landmarks.

        Returns:
            (predicted_sign: str or None, confidence: float in [0,1])
        """
        if self.model is None:
            return None, 0.0

        if min_frames is None:
            # Require at least some fraction of the target sequence
            min_frames = min(30, self.sequence_length)

        if len(landmark_sequence) < min_frames:
            return None, 0.0

        try:
            features = self.preprocess_sequence(landmark_sequence)
            predictions = self.model.predict(features, verbose=0)[0]  # shape: (num_classes,)

            predicted_idx = int(np.argmax(predictions))
            confidence = float(predictions[predicted_idx])

            sign = self.idx_to_sign.get(predicted_idx)
            if sign is not None and confidence >= threshold:
                return sign, confidence

            return None, confidence

        except Exception as e:
            print(f"Error during prediction: {e}")
            return None, 0.0

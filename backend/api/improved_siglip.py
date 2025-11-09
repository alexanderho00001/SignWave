"""
Improved SigLIP model wrapper with preprocessing and temporal smoothing
"""
import cv2
import numpy as np
from PIL import Image
import torch
import mediapipe as mp
from collections import deque

class ImprovedSigLIPModel:
    def __init__(self, model, processor, smoothing_window=5, confidence_threshold=0.3):
        """
        Initialize improved SigLIP model wrapper
        
        Args:
            model: The SigLIP model
            processor: The image processor
            smoothing_window: Number of recent predictions to average (temporal smoothing)
            confidence_threshold: Minimum confidence to return a prediction
        """
        self.model = model
        self.processor = processor
        self.smoothing_window = smoothing_window
        self.confidence_threshold = confidence_threshold
        
        # Initialize MediaPipe for hand detection
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Buffer for temporal smoothing
        self.prediction_buffer = deque(maxlen=smoothing_window)
        
    def detect_and_crop_hand(self, image):
        """
        Detect hand in image and crop to hand region with padding
        
        Returns:
            cropped_image: PIL Image of cropped hand, or original if no hand detected
            hand_detected: bool indicating if hand was found
        """
        # Convert PIL to numpy array
        img_array = np.array(image)
        rgb_image = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        
        # Detect hands
        results = self.hands.process(cv2.cvtColor(rgb_image, cv2.COLOR_BGR2RGB))
        
        if not results.multi_hand_landmarks:
            return image, False
        
        # Get hand landmarks
        hand_landmarks = results.multi_hand_landmarks[0]
        
        # Get bounding box
        h, w = img_array.shape[:2]
        x_coords = [landmark.x * w for landmark in hand_landmarks.landmark]
        y_coords = [landmark.y * h for landmark in hand_landmarks.landmark]
        
        x_min, x_max = int(min(x_coords)), int(max(x_coords))
        y_min, y_max = int(min(y_coords)), int(max(y_coords))
        
        # Add padding (20% of bounding box size)
        padding_x = int((x_max - x_min) * 0.2)
        padding_y = int((y_max - y_min) * 0.2)
        
        x_min = max(0, x_min - padding_x)
        y_min = max(0, y_min - padding_y)
        x_max = min(w, x_max + padding_x)
        y_max = min(h, y_max + padding_y)
        
        # Crop image
        cropped = img_array[y_min:y_max, x_min:x_max]
        
        # Resize to square while maintaining aspect ratio
        crop_h, crop_w = cropped.shape[:2]
        target_size = max(crop_h, crop_w)
        
        # Create square image with padding
        square_img = np.ones((target_size, target_size, 3), dtype=np.uint8) * 255
        y_offset = (target_size - crop_h) // 2
        x_offset = (target_size - crop_w) // 2
        square_img[y_offset:y_offset+crop_h, x_offset:x_offset+crop_w] = cropped
        
        return Image.fromarray(square_img), True
    
    def preprocess_image(self, image):
        """
        Preprocess image: enhance contrast, normalize, etc.
        """
        # Convert to numpy array
        img_array = np.array(image)
        
        # Convert to LAB color space for better contrast enhancement
        lab = cv2.cvtColor(img_array, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Merge back
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
        
        return Image.fromarray(enhanced)
    
    def predict_single(self, image, use_hand_crop=True, use_preprocessing=True):
        """
        Make a single prediction
        
        Args:
            image: PIL Image
            use_hand_crop: Whether to crop to hand region
            use_preprocessing: Whether to apply image enhancement
        
        Returns:
            predictions: dict of {letter: confidence}
        """
        processed_image = image
        
        # Hand detection and cropping
        if use_hand_crop:
            processed_image, hand_detected = self.detect_and_crop_hand(processed_image)
            if not hand_detected:
                # If no hand detected, still process but might be less accurate
                pass
        
        # Image preprocessing
        if use_preprocessing:
            processed_image = self.preprocess_image(processed_image)
        
        # Process with SigLIP
        inputs = self.processor(images=processed_image, return_tensors="pt")
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probs = torch.nn.functional.softmax(logits, dim=1).squeeze().tolist()
        
        # Map to letters
        labels = {
            "0": "A", "1": "B", "2": "C", "3": "D", "4": "E", "5": "F", "6": "G", "7": "H", "8": "I", "9": "J",
            "10": "K", "11": "L", "12": "M", "13": "N", "14": "O", "15": "P", "16": "Q", "17": "R", "18": "S", "19": "T",
            "20": "U", "21": "V", "22": "W", "23": "X", "24": "Y", "25": "Z"
        }
        
        predictions = {labels[str(i)]: probs[i] for i in range(len(probs))}
        
        return predictions
    
    def predict_with_smoothing(self, image, use_hand_crop=True, use_preprocessing=True):
        """
        Make prediction with temporal smoothing
        
        Args:
            image: PIL Image
            use_hand_crop: Whether to crop to hand region
            use_preprocessing: Whether to apply image enhancement
        
        Returns:
            smoothed_predictions: dict of {letter: averaged_confidence}
            raw_predictions: dict of current frame predictions
        """
        # Get current prediction
        raw_predictions = self.predict_single(image, use_hand_crop, use_preprocessing)
        
        # Add to buffer
        self.prediction_buffer.append(raw_predictions)
        
        # Average predictions in buffer
        if len(self.prediction_buffer) == 0:
            return raw_predictions, raw_predictions
        
        # Calculate average probabilities
        smoothed = {}
        for letter in raw_predictions.keys():
            avg_conf = sum(pred[letter] for pred in self.prediction_buffer) / len(self.prediction_buffer)
            smoothed[letter] = avg_conf
        
        return smoothed, raw_predictions
    
    def get_top_prediction(self, predictions):
        """
        Get top prediction with confidence check
        
        Returns:
            (letter, confidence) or (None, 0) if below threshold
        """
        sorted_preds = sorted(predictions.items(), key=lambda x: x[1], reverse=True)
        top_letter, top_conf = sorted_preds[0]
        
        if top_conf >= self.confidence_threshold:
            return top_letter, top_conf
        else:
            return None, top_conf
    
    def reset_buffer(self):
        """Reset the prediction buffer"""
        self.prediction_buffer.clear()


import os

# 1. Disable GPU completely - force TensorFlow to use CPU
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

# 2. Quiet TF a bit (optional)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "1"  # 0 = all logs

# 3. Disable XLA JIT
os.environ["TF_XLA_FLAGS"] = "--tf_xla_enable_xla_devices=false --tf_xla_auto_jit=0"

import json
import numpy as np
import tensorflow as tf
import mediapipe as mp

# 4. Extra safety: turn off graph JIT and run functions eagerly
try:
    tf.config.optimizer.set_jit(False)
except Exception:
    pass

tf.config.run_functions_eagerly(True)

from .src.backbone import TFLiteModel, get_model
from .src.config import SEQ_LEN, THRESH_HOLD
from .src.landmarks_extraction import extract_coordinates

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 1) Load model weights exactly like the repo
MODELS_PATH = [
    os.path.join(BASE_DIR, "api", "pretrained", "islr-fp16-192-8-seed_all42-foldall-last.h5"),
]

_keras_models = [get_model(max_len=SEQ_LEN) for _ in MODELS_PATH]
for m, p in zip(_keras_models, MODELS_PATH):
    print(f"[*] Loading weights from {p}")
    m.load_weights(p, by_name=True, skip_mismatch=True)

islr_model = TFLiteModel(islr_models=_keras_models)

# 2) Load label map (index -> sign)
LABEL_MAP_PATH = os.path.join(BASE_DIR, "api", "pretrained", "sign_to_prediction_index_map.json")
with open(LABEL_MAP_PATH, "r", encoding="utf-8") as f:
    sign_to_idx = json.load(f)

idx_to_sign = {int(v): k for k, v in sign_to_idx.items()}

# 3) MediaPipe Holistic - Create per-session instances to avoid timestamp conflicts
mp_holistic = mp.solutions.holistic
# Global holistic instance (for backward compatibility)
holistic = mp_holistic.Holistic(
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# Per-session holistic instances to avoid timestamp mismatch errors
holistic_instances = {}

def get_holistic_for_session(session_id):
    """Get or create a holistic instance for a specific session"""
    if session_id not in holistic_instances:
        holistic_instances[session_id] = mp_holistic.Holistic(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
    return holistic_instances[session_id]

# 4) Per-session sequence buffers
sequence_buffers = {}

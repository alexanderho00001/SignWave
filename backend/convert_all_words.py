"""
Convert ALL 250 words from ASL-signs dataset
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from api.parquet_to_json_converter import batch_convert_signs

ASL_SIGNS_DIR = r"C:\Users\rimsh\Downloads\asl-signs"
TRAIN_CSV = os.path.join(ASL_SIGNS_DIR, "train.csv")
OUTPUT_DIR = r"c:\Users\rimsh\Desktop\SignWave\backend\reference_signs"

print("Converting ALL 250 ASL word signs...")
print("This may take 2-3 minutes...")
print("")

batch_convert_signs(ASL_SIGNS_DIR, TRAIN_CSV, OUTPUT_DIR, limit=None)

print("")
print("[DONE] All words converted successfully!")
print(f"Check: {OUTPUT_DIR}/words/")

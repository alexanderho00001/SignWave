"""
Quick script to convert specific ASL signs that are most useful
"""
import sys
import os

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from api.parquet_to_json_converter import batch_convert_signs

# Configuration
ASL_SIGNS_DIR = r"C:\Users\rimsh\Downloads\asl-signs"
TRAIN_CSV = os.path.join(ASL_SIGNS_DIR, "train.csv")
OUTPUT_DIR = r"c:\Users\rimsh\Desktop\SignWave\backend\reference_signs"

print("=" * 60)
print("Converting ASL Signs - Quick Setup")
print("=" * 60)
print("\nThis will convert commonly used signs for your app.")
print("You can convert all 250 later if needed.\n")

# Convert first 50 signs (enough to test and demo)
print("Converting first 50 unique signs...")
batch_convert_signs(ASL_SIGNS_DIR, TRAIN_CSV, OUTPUT_DIR, limit=50)

print("\n" + "=" * 60)
print("✅ Done! You now have 50 sign demonstrations.")
print("=" * 60)
print("\nTo convert ALL 250 signs, run:")
print("  batch_convert_signs(ASL_SIGNS_DIR, TRAIN_CSV, OUTPUT_DIR, limit=None)")

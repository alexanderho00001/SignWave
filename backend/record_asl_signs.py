"""
Simple script to record ASL reference signs using MediaPipe
For letters (A-Z) and numbers (0-9)
"""
import cv2
import mediapipe as mp
import json
import os
import time

# Configuration
FRAME_RATE = 10
DURATION_SECONDS = 2.5
TOTAL_FRAMES = int(FRAME_RATE * DURATION_SECONDS)

def record_sign(sign_name, sign_type='letters'):
    """Record a sign using webcam and MediaPipe"""
    print(f"\n[Recording] Sign: {sign_name}")
    print(f"Get ready! Recording will start in 3 seconds...")
    print(f"Hold the sign steady for {DURATION_SECONDS} seconds")

    cap = cv2.VideoCapture(0)
    mp_holistic = mp.solutions.holistic.Holistic(
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    mp_drawing = mp.solutions.drawing_utils

    frames_data = []
    frame_count = 0
    recording = False
    countdown = 3

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        if not recording:
            cv2.putText(frame, f"Starting in {countdown}...",
                       (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 3)
            cv2.putText(frame, f"Sign: {sign_name}",
                       (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255, 255, 255), 2)
            cv2.imshow('Record ASL Sign', frame)

            key = cv2.waitKey(1000)
            if key & 0xFF == ord('q'):
                cap.release()
                cv2.destroyAllWindows()
                mp_holistic.close()
                return False

            countdown -= 1
            if countdown < 0:
                recording = True
            continue

        results = mp_holistic.process(rgb_frame)

        # Draw landmarks on frame for feedback
        if results.face_landmarks:
            mp_drawing.draw_landmarks(frame, results.face_landmarks, mp.solutions.holistic.FACEMESH_TESSELATION,
                                     mp_drawing.DrawingSpec(color=(80,110,10), thickness=1, circle_radius=1))
        if results.pose_landmarks:
            mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp.solutions.holistic.POSE_CONNECTIONS)
        if results.left_hand_landmarks:
            mp_drawing.draw_landmarks(frame, results.left_hand_landmarks, mp.solutions.holistic.HAND_CONNECTIONS)
        if results.right_hand_landmarks:
            mp_drawing.draw_landmarks(frame, results.right_hand_landmarks, mp.solutions.holistic.HAND_CONNECTIONS)

        landmarks = []

        if results.face_landmarks:
            for idx, landmark in enumerate(results.face_landmarks.landmark):
                landmarks.append({
                    'type': 'face',
                    'landmark_index': idx,
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z
                })

        if results.pose_landmarks:
            for idx, landmark in enumerate(results.pose_landmarks.landmark):
                landmarks.append({
                    'type': 'pose',
                    'landmark_index': idx,
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z
                })

        if results.left_hand_landmarks:
            for idx, landmark in enumerate(results.left_hand_landmarks.landmark):
                landmarks.append({
                    'type': 'left_hand',
                    'landmark_index': idx,
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z
                })

        if results.right_hand_landmarks:
            for idx, landmark in enumerate(results.right_hand_landmarks.landmark):
                landmarks.append({
                    'type': 'right_hand',
                    'landmark_index': idx,
                    'x': landmark.x,
                    'y': landmark.y,
                    'z': landmark.z
                })

        if len(landmarks) > 0:
            frames_data.append({
                'frame': frame_count,
                'landmarks': landmarks
            })
            frame_count += 1

        progress = (frame_count / TOTAL_FRAMES) * 100
        cv2.putText(frame, f"RECORDING: {frame_count}/{TOTAL_FRAMES}",
                   (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        cv2.rectangle(frame, (50, 80), (int(50 + progress * 5), 110), (0, 0, 255), -1)

        cv2.imshow('Record ASL Sign', frame)

        if cv2.waitKey(100) & 0xFF == ord('q') or frame_count >= TOTAL_FRAMES:
            break

    cap.release()
    cv2.destroyAllWindows()
    mp_holistic.close()

    if len(frames_data) > 0:
        output_dir = f'reference_signs/{sign_type}'
        os.makedirs(output_dir, exist_ok=True)
        output_path = f'{output_dir}/{sign_name.lower()}.json'

        data = {
            'total_frames': len(frames_data),
            'frames': frames_data
        }

        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"[OK] Saved {len(frames_data)} frames to {output_path}")
        return True
    else:
        print(f"[ERROR] No landmarks detected. Please try again.")
        return False


def record_alphabet():
    """Record all 26 letters A-Z"""
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    print("=" * 60)
    print("[Recording ASL Alphabet (A-Z)]")
    print("=" * 60)

    for letter in letters:
        input(f"\nPress Enter to record letter '{letter}'...")
        success = record_sign(letter, 'letters')
        if not success:
            retry = input("Retry? (y/n): ")
            if retry.lower() == 'y':
                record_sign(letter, 'letters')


def record_numbers():
    """Record all 10 numbers 0-9"""
    numbers = '0123456789'

    print("=" * 60)
    print("[Recording ASL Numbers (0-9)]")
    print("=" * 60)

    for number in numbers:
        input(f"\nPress Enter to record number '{number}'...")
        success = record_sign(number, 'numbers')
        if not success:
            retry = input("Retry? (y/n): ")
            if retry.lower() == 'y':
                record_sign(number, 'numbers')


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("[ASL Sign Recording Tool]")
    print("=" * 60)
    print("\nWhat would you like to record?")
    print("1. Single sign")
    print("2. All letters (A-Z)")
    print("3. All numbers (0-9)")
    print("4. Both letters and numbers")

    choice = input("\nEnter choice (1-4): ")

    if choice == '1':
        sign = input("Enter sign name: ")
        sign_type = input("Enter type (letters/numbers/words): ")
        record_sign(sign, sign_type)
    elif choice == '2':
        record_alphabet()
    elif choice == '3':
        record_numbers()
    elif choice == '4':
        record_alphabet()
        print("\n" + "=" * 60)
        input("\nPress Enter to continue to numbers...")
        record_numbers()
    else:
        print("Invalid choice")

    print("\n[DONE] Recording complete!")

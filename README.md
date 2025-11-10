# SignWave – Learn ASL with AI

natHACKS 2025 Submission
Team: The She-Coders With A He

# Project Overview

SignWave is an interactive web-based platform that helps users learn American Sign Language (ASL) through real-time feedback powered by AI and machine learning. Using computer vision, users sign into their webcam and receive instant feedback on accuracy and gesture clarity.

# Device Concept

AI-Powered Feedback: Uses pre-trained models to detect and classify hand gestures.

Lessons: Learn the ASL alphabet, numbers, and basic vocabulary.

Mini-Games: Practice with gamified challenges—sign falling prompts, multiplayer sign battles, and more.

Progress Tracking: Automatically saves learning progress for continuous development.

# Presentation Slides:
https://docs.google.com/presentation/d/1WiH7RLNqYsvKz_j57tKsCj6MxtciMwE06PnfUDERmio/edit?usp=sharing

# How It Works

Open the website and allow webcam access, and choose a lesson to begin learning ASL. 
Follow the on-screen prompt and perform hand signs. 
Use the "Reveal Answer" button if you do not know the sign. 
Play games with others to test your skill.

### Local Setup Guide

1. Clone the repository
   ```bash
   git clone https://github.com/alexanderho00001/SignWave.git
   ```

2. Go into the repository
   ```bash
   cd SignWave
   ```

3. Create a virtual environment
   ```bash
   python3 -m venv venv
   ```

4. Activate the virtual environment
   ```bash
   source venv/bin/activate
   ```

5. Go into the backend
   ```bash
   cd backend
   ```

6. Install the backend requirements
   ```bash
   pip install -r requirements.txt
   ```

7. Start the backend server
   ```bash
   python3 manage.py runserver
   ```

8. Open a new terminal window

9. Go into the repository again
   ```bash
   cd SignWave
   ```

10. Activate the virtual environment
    ```bash
    source venv/bin/activate
    ```

11. Go into the frontend
    ```bash
    cd frontend
    ```

12. Install frontend dependencies
    ```bash
    npm i
    ```

13. Start the frontend server
    ```bash
    npm run dev
    ```

14. Open the app in your browser
    Visit → http://localhost:3000

---


# Credits

Hand sign references from https://www.lifeprint.com/asl101/pages-layout/fingerspelling.htm
Pre-trained AI model for letters from https://huggingface.co/prithivMLmods/Alphabet-Sign-Language-Detection
Pre-trained AI model for words from https://github.com/209sontung/sign-language
Powered by TensorFlow, MediaPipe, and React

Built during natHACKS 2025

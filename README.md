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
!. Clone the repository
Clone the repository into your local device
2. cd SignWave
Go into the repository
3. python3 -m venv venv
Create a virtual environment
4. source venv/bin/activate
Activate that virtual environment
5. cd backend
Go into the backend
6. pip install -r requirements.txt
Install the requirements
7. python3 manage.py runserver
Start the backend server
8. Open a new terminal
Open a brand new terminal
9. cd SignWave
Go into the repository
10. source venv/bin/activate
Activate a virtual environment
11. cd frontend
Go into the frontend
12. npm i
Install the frontend packages
13. npm run dev
Start the frontend server
14. Open on local host
Open the server in your browser

Open the website and allow webcam access, and choose a lesson to begin learning ASL. 
Follow the on-screen prompt and perform hand signs. 
Use the "Reveal Answer" button if you do not know the sign. 
Play games with others to test your skill.

# Credits

Hand sign references from https://www.lifeprint.com/asl101/pages-layout/fingerspelling.htm
Pre-trained AI model for letters from https://huggingface.co/prithivMLmods/Alphabet-Sign-Language-Detection
Pre-trained AI model for words from https://github.com/209sontung/sign-language
Powered by TensorFlow, MediaPipe, and React

Built during natHACKS 2025

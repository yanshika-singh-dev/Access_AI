# AccessAI — Unified AI Accessibility Platform

> **WeSee** for the visually impaired + **SignSpeak** for the deaf and hard of hearing.
> 100% free, runs entirely in the browser — no server, no API keys.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-FF6F00)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

### 🤟 SignSpeak — Sign Language Recognition
- **Letter mode** — Finger-spell A–Z using ASL, recognized in real time
- **Gesture mode** — 23 everyday gestures (YES, NO, HELP, THANK YOU, WATER, WASHROOM, WHO, WHAT, WHERE…)
- **99.3% accuracy** on both letters and gestures — trained on real hand data using a custom MLP neural network
- **Text-to-speech** — recognized signs are spoken aloud
- **Virtual keyboard** — fallback for hard-to-sign letters
- Runs fully offline in the browser using pure JavaScript inference (no TF.js)

### 👁️ WeSee — Visual Assistance
- AI-powered scene description for the visually impaired
- Works with live camera feed

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A modern browser with webcam access (Chrome / Edge recommended)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/access_ai.git
cd access_ai
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🧠 How SignSpeak ML Works

SignSpeak uses a custom-trained **MLP (Multi-Layer Perceptron)** neural network — not a pre-trained model. The model was trained entirely on hand data collected through the browser using MediaPipe hand landmarks.

### Architecture
```
Input: 63 features (21 landmarks × x, y, z coordinates)
       ↓
BatchNormalization
       ↓
Dense(256) → ReLU → Dropout(0.4)
       ↓
Dense(128) → ReLU → Dropout(0.4)
       ↓
Dense(64)  → ReLU → Dropout(0.2)
       ↓
Dense(26)  → Softmax   [letters]
Dense(23)  → Softmax   [gestures]
```

### Training Pipeline
```
Browser data collector → asl_keypoints.csv / gesture_keypoints.csv
        ↓
Python MLP trainer (TensorFlow/Keras)
        ↓
Weight export as JSON
        ↓
Pure JS inference in browser (zero dependencies)
```

### Model Files (not included in repo — generate your own)
| File | Description |
|------|-------------|
| `public/model_weights.json` | Letter MLP weights |
| `public/label_map.json` | Letter class index → A–Z |
| `public/gesture_weights.json` | Gesture MLP weights |
| `public/gesture_label_map.json` | Gesture class index → label |

---

## 🏋️ Training Your Own Model

The models are personal — trained on **your** hand. Follow these steps:

### 1. Collect letter data
```bash
cd signspeak_ml/data_collector
npx serve .
# Open http://localhost:3000/collect_data.html
# Record 600–1000 samples per letter (A–Z)
```

### 2. Collect gesture data
```bash
# Open http://localhost:3000/collect_gestures.html
# Record 600+ samples per gesture
```

### 3. Train letter model
```bash
cd signspeak_ml/python_trainer
pip install tensorflow scikit-learn matplotlib numpy pandas
python 2_train_model.py
python 4_export_weights.py
```

### 4. Train gesture model
```bash
python 5_train_gestures.py
```

### 5. Copy model files to React project
```bash
cp model_weights.json ../access_ai/public/
cp label_map.json ../access_ai/public/
cp gesture_weights.json ../access_ai/public/
cp gesture_label_map.json ../access_ai/public/
```

---

## 📁 Project Structure

```
access_ai/
├── public/
│   ├── model_weights.json        # Letter MLP weights (gitignored — generate locally)
│   ├── label_map.json            # Letter class map
│   ├── gesture_weights.json      # Gesture MLP weights (gitignored)
│   └── gesture_label_map.json    # Gesture class map
├── src/
│   ├── components/
│   │   ├── signspeak/
│   │   │   └── SignSpeak.jsx     # Main SignSpeak component
│   │   └── wesee/
│   │       └── WeSee.jsx         # WeSee component
│   ├── hooks/
│   │   └── useMLClassifier.js    # (legacy — now handled in asl.js)
│   └── utils/
│       ├── asl.js                # ML inference engine (letters + gestures)
│       ├── mediapipe.js          # MediaPipe Hands setup
│       └── speech.js             # Text-to-speech utilities
├── signspeak_ml/                 # Training pipeline (not deployed)
│   ├── data_collector/
│   │   ├── collect_data.html     # Letter data collector
│   │   └── collect_gestures.html # Gesture data collector
│   └── python_trainer/
│       ├── 2_train_model.py      # Letter MLP training
│       ├── 4_export_weights.py   # Export weights to JSON
│       └── 5_train_gestures.py   # Gesture MLP training
└── README.md
```

---

## 🤟 Supported Gestures

| Category | Gestures |
|----------|----------|
| Responses | YES 👍, NO 👎, OK 👌, SORRY 😔 |
| Social | HELLO 👋, THANK YOU 🙏, PLEASE 🤲, I LOVE YOU 🤟, ROCK ON 🤘, CALL ME 🤙, PEACE ✌️ |
| Needs | HELP 🆘, STOP ✋, EAT 🍴, DRINK 🥤, WATER 💧, WASHROOM 🚽, PAIN 😣 |
| Questions | WHO 🧑, WHAT 🤔, WHERE 📍, WHEN ⏰, WHICH 🔀, COME HERE 🫴 |

---

## 🛠️ Tech Stack

- **Frontend** — React 18, Vite 5
- **Hand tracking** — MediaPipe Hands
- **ML training** — TensorFlow/Keras (Python)
- **ML inference** — Pure JavaScript (no TF.js runtime)
- **Speech** — Web Speech API

---

## 👥 Author 

Built by Yanshika Singh

---

## 📄 License

MIT — free to use, modify and distribute.
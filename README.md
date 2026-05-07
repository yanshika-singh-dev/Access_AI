# AccessAI — Unified AI Accessibility Platform

> Two AI tools. One platform. Zero cost.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-FF6F00)](https://mediapipe.dev)
[![COCO-SSD](https://img.shields.io/badge/COCO--SSD-MobileNetV2-00BFFF)](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

AccessAI brings together two real-time AI tools designed to make daily life more accessible — one for the **deaf and hard of hearing**, one for the **visually impaired**. Both run entirely in the browser with no server, no API keys, and no cost.

---

## 👁️ WeSee — Vision Assistant for the Blind

WeSee uses your device camera and a **COCO-SSD** object detection model to describe the environment around you in real time.

### Features
- **Detects 80+ object classes** — people, vehicles, furniture, animals, everyday items and more
- **Distance estimation** — classifies each object as Very Close, Close, Medium, or Far
- **Position awareness** — tells you whether objects are on your left, center, or right
- **Hazard alerts** — automatically flags dangerous nearby objects (e.g. cars, knives, fire) with a pulsing warning banner and priority voice announcement
- **Navigation advice** — generates contextual movement guidance based on what's detected (e.g. "Path seems clear on the left")
- **Voice feedback** — automatically speaks descriptions aloud, with hazard alerts every 3 seconds and regular updates every 6 seconds
- **Multilingual support** — English, Hindi (हिंदी), and Marathi (मराठी)
- **Two detection modes** — Detect Once (single snapshot) or Live Detect (continuous real-time loop)
- **Adjustable sensitivity** — slider from High (more objects) to Strict (high confidence only)
- **Live FPS display** — shows real-time performance

### How it works
```
Camera feed → COCO-SSD + MobileNetV2 (TF.js) → Bounding boxes + labels
                    ↓
     Distance + position estimation per object
                    ↓
     Hazard detection → Voice alert (Web Speech API)
                    ↓
     Navigation advice → Spoken guidance
```

---

## 🤟 SignSpeak — Sign Language Detector for the Deaf

SignSpeak uses **MediaPipe Hands** and a custom-trained **MLP neural network** to recognize ASL finger-spelling and everyday gestures in real time.

### Features
- **Letter mode** — Finger-spell A–Z, builds words letter by letter
- **Gesture mode** — Recognizes 23 everyday gestures across 4 categories
- **99.3% accuracy** on both letters and gestures — trained on real hand data
- **Text-to-speech** — every recognized letter and gesture is spoken aloud
- **Hold-to-confirm** — requires holding a sign steady for ~1 second to avoid false positives
- **Virtual keyboard** — manual fallback for letters that are hard to sign
- **Debug mode** — shows live confidence scores for each prediction
- **Auto space** — inserts a space after a pause in signing
- **Runs offline** — pure JavaScript MLP inference, no TF.js, no server

### Supported gestures (23 total)

| Category | Gestures |
|----------|----------|
| Responses | YES 👍, NO 👎, OK 👌, SORRY 😔 |
| Social | HELLO 👋, THANK YOU 🙏, PLEASE 🤲, I LOVE YOU 🤟, ROCK ON 🤘, CALL ME 🤙, PEACE ✌️ |
| Needs | HELP 🆘, STOP ✋, EAT 🍴, DRINK 🥤, WATER 💧, WASHROOM 🚽, PAIN 😣 |
| Questions | WHO 🧑, WHAT 🤔, WHERE 📍, WHEN ⏰, WHICH 🔀, COME HERE 🫴 |

### How it works
```
Camera feed → MediaPipe Hands → 21 landmarks (x, y, z)
                    ↓
     Wrist-relative normalisation (63 features)
                    ↓
     MLP inference (pure JS, no dependencies)
                    ↓
     Hold-to-confirm → Text-to-speech output
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Chrome or Edge (recommended for best MediaPipe + Web Speech support)
- Webcam

### Installation

```bash
git clone https://github.com/yanshikasingh055-spec/Access_AI.git
cd Access_AI
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

> **Note:** The ML model files for SignSpeak (`model_weights.json`, `gesture_weights.json`, etc.) are not included in the repo — they are personal to each user's hand. See the Training section below to generate your own.

---

## 🧠 SignSpeak ML Architecture

SignSpeak uses a custom MLP trained entirely on hand landmark data collected through the browser — not a pre-trained model.

```
Input: 63 features (21 landmarks × x, y, z)
       ↓
BatchNormalization
       ↓
Dense(256) → ReLU → Dropout(0.4)   [letters]
Dense(128) → ReLU → Dropout(0.4)   [both]
Dense(128) → ReLU → Dropout(0.4)   [gestures]
       ↓
Dense(64)  → ReLU → Dropout(0.2)
       ↓
Dense(26/23) → Softmax
```

### Training pipeline

```
Browser data collector (HTML + MediaPipe)
        ↓
asl_keypoints.csv / gesture_keypoints.csv
        ↓
Python MLP trainer (TensorFlow/Keras)
        ↓
Weight export → JSON
        ↓
Pure JS matrix inference in browser
```

---

## 🏋️ Train Your Own SignSpeak Model

The models are personal — trained on **your** hand shape and lighting. Follow these steps:

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
# Record 600+ samples per gesture (23 gestures)
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
cp model_weights.json ../../public/
cp label_map.json ../../public/
cp gesture_weights.json ../../public/
cp gesture_label_map.json ../../public/
```

---

## 📁 Project Structure

```
Access_AI/
├── public/
│   ├── mediapipe/                    # Offline MediaPipe Hands files
│   ├── model_weights.json            # Letter MLP weights (gitignored)
│   ├── label_map.json                # Letter class map (gitignored)
│   ├── gesture_weights.json          # Gesture MLP weights (gitignored)
│   └── gesture_label_map.json        # Gesture class map (gitignored)
├── src/
│   ├── components/
│   │   ├── signspeak/
│   │   │   └── SignSpeak.jsx         # SignSpeak UI + detection logic
│   │   └── wesee/
│   │       └── WeSee.jsx             # WeSee UI + detection loop
│   ├── hooks/
│   │   └── useCamera.js              # Camera access hook (used by WeSee)
│   └── utils/
│       ├── asl.js                    # MLP inference engine (letters + gestures)
│       ├── detector.js               # COCO-SSD inference + hazard logic (WeSee)
│       ├── mediapipe.js              # MediaPipe Hands setup (SignSpeak)
│       └── speech.js                 # Text-to-speech (multilingual)
├── signspeak_ml/                     # Training pipeline (not deployed)
│   ├── data_collector/
│   │   ├── collect_data.html         # Letter landmark collector
│   │   └── collect_gestures.html     # Gesture landmark collector
│   └── python_trainer/
│       ├── 2_train_model.py          # Letter MLP training
│       ├── 4_export_weights.py       # Export weights → JSON
│       └── 5_train_gestures.py       # Gesture MLP training
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | WeSee | SignSpeak |
|-------|-------|-----------|
| Detection | COCO-SSD (TF.js) | MediaPipe Hands |
| ML inference | TensorFlow.js | Pure JS matrix math |
| Training | TF.js COCO-SSD (pretrained) | TensorFlow/Keras (custom) |
| Voice output | Web Speech API (EN/HI/MR) | Web Speech API (EN) |
| Framework | React 18 + Vite 5 | React 18 + Vite 5 |

---

## 👩‍💻 Author

Built by **Yanshika Singh** — VIT Bhopal University

---

## 📄 License

MIT — free to use, modify and distribute.
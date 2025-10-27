
# Gestyx - AI-Powered Body Language Analysis Platform

<div align="center">

![Gestyx Banner](https://img.shields.io/badge/Gestyx-AI%20Body%20Language%20Analysis-blue?style=for-the-badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square&logo=react)](https://reactjs.org/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.22-orange?style=flat-square&logo=tensorflow)](https://www.tensorflow.org/js)

**Real-time AI feedback on body language, posture, and non-verbal communication**

[Demo](https://gestyx.replit.app) • [Documentation](./LearnMore.md) • [Report Bug](https://github.com/yourusername/gestyx/issues) • [Request Feature](https://github.com/yourusername/gestyx/issues)

</div>

---

## 🎯 Overview

**Gestyx** is an advanced AI-powered web application that provides comprehensive real-time feedback on body language, facial expressions, posture, and non-verbal communication. Built with cutting-edge machine learning models, Gestyx empowers users to improve their communication skills for interviews, presentations, education, and professional development.

### ✨ Key Features

- 🎥 **Real-Time Analysis**: Live webcam analysis with multiple specialized modes
- 📸 **Static Media Analysis**: Upload images, videos, or audio for comprehensive AI insights
- 🎓 **Education Mode**: Track student attention, engagement, and learning readiness
- 💼 **Interview Mode**: Assess confidence, professionalism, and communication quality
- 😊 **Expressions Mode**: Real-time facial expression and emotion detection
- 📊 **Advanced Metrics**: Posture analysis, gesture recognition, and biomechanics tracking
- 📱 **Responsive Design**: Seamless experience across desktop and mobile devices
- 🌙 **Dark Mode**: Full theming support with light and dark modes
- 💾 **Local History**: Device-based session tracking without mandatory authentication

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Modern browser** with WebGL support (Chrome, Firefox, Edge)
- **Google Gemini API Key** for comprehensive analysis

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/gestyx.git
cd gestyx
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

4. **Start the development server**
```bash
npm run dev
```

5. **Open your browser**
Navigate to `http://localhost:5000`

### Build for Production

```bash
npm run build
npm start
```

---

## 🏗️ Architecture

### Tech Stack

#### Frontend
- **React 18.3** with TypeScript - Component-based UI
- **Vite** - Lightning-fast build tool and dev server
- **Shadcn UI** (New York style) - Themeable component system
- **Radix UI** - Accessible, unstyled primitives
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Server state management
- **Wouter** - Lightweight client-side routing

#### Machine Learning
- **TensorFlow.js 4.22** - Client-side ML inference (WebGL/CPU)
- **MoveNet** - Pose detection and body alignment
- **MediaPipe FaceMesh** - Facial landmark tracking
- **Face-API.js** - Emotion recognition and facial analysis
- **Google Gemini AI** - Comprehensive body language interpretation

#### Backend
- **Node.js** with Express.js - RESTful API server
- **TypeScript** - End-to-end type safety
- **Multer** - Multipart form data handling (50MB limit)
- **Zod** - Runtime schema validation

#### Storage (Optional)
- **Drizzle ORM** - Type-safe PostgreSQL ORM (schema defined)
- **Neon Database** - Serverless PostgreSQL (future use)
- **In-Memory Storage** - Current implementation using Map objects

### System Design

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Upload     │  │     Live     │  │   History    │      │
│  │   Analysis   │  │   Analysis   │  │   Viewer     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│  ┌─────────────────────────▼──────────────────────────┐    │
│  │         TensorFlow.js (Client-side ML)             │    │
│  │  • MoveNet (Pose)  • FaceMesh  • Face-API (Emotion)│    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                             │
                    HTTP/REST API
                             │
┌─────────────────────────────▼───────────────────────────────┐
│                    Server (Express.js)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  File Upload │  │   Analysis   │  │   History    │      │
│  │   Endpoint   │  │   Retrieval  │  │   Storage    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│  ┌─────────────────────────▼──────────────────────────┐    │
│  │           Google Gemini AI (Server-side)           │    │
│  │     Comprehensive Body Language Interpretation     │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
gestyx/
├── client/                      # Frontend React application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/              # Shadcn UI primitives
│   │   │   ├── Header.tsx       # Navigation header
│   │   │   ├── ScoreDisplay.tsx # Analysis score visualization
│   │   │   └── ModelPreloader.tsx # ML model loading
│   │   ├── pages/               # Route pages
│   │   │   ├── Home.tsx         # Upload/capture media
│   │   │   ├── LiveAnalysis.tsx # Real-time webcam analysis
│   │   │   ├── Results.tsx      # Analysis results display
│   │   │   └── History.tsx      # Analysis history
│   │   ├── lib/                 # Utilities and helpers
│   │   │   ├── api.ts           # API client functions
│   │   │   ├── modelLoader.ts   # TensorFlow.js model management
│   │   │   └── deviceId.ts      # Device identification
│   │   ├── hooks/               # Custom React hooks
│   │   ├── utils/               # Utility functions
│   │   ├── App.tsx              # Root component
│   │   └── main.tsx             # Application entry point
│   └── index.html               # HTML template
├── server/                      # Backend Express.js server
│   ├── index.ts                 # Server entry point
│   ├── routes.ts                # API route definitions
│   ├── gemini.ts                # Gemini AI integration
│   ├── storage.ts               # Data storage interface
│   └── vite.ts                  # Vite dev server integration
├── shared/                      # Shared types and schemas
│   └── schema.ts                # Zod validation schemas
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite build configuration
├── tailwind.config.ts           # Tailwind CSS configuration
└── README.md                    # This file
```

---

## 🎨 Analysis Modes

### 📸 Static Upload Mode
Upload or capture images, videos, or audio files for comprehensive AI-powered analysis using Google Gemini.

**Features:**
- Image analysis (posture, facial expressions, gestures)
- Video analysis (movement patterns, temporal dynamics)
- Audio analysis (vocal tone, speech patterns)
- Comprehensive written feedback and actionable insights

### 🎥 Live Analysis Modes

#### 🎓 Education Mode
Real-time student engagement and attention tracking for learning environments.

**Metrics:**
- Attention Score (0-100%)
- Engagement Level (LOW/MEDIUM/HIGH/VERY HIGH)
- Focus Quality
- Learning Readiness
- Distraction Flags (looking away, head down, fidgeting)
- Participation Indicators (nodding, hand raised, note-taking)

#### 💼 Interview Mode
Professional presence and communication assessment for interview preparation.

**Metrics:**
- Confidence Score (0-100%)
- Professionalism Level (POOR/FAIR/GOOD/EXCELLENT)
- Energy Level
- Authenticity Score
- Communication Quality
- Stress Indicators
- Body Language Strengths
- Areas for Improvement

#### 😊 Expressions Mode
Real-time facial expression and emotion detection with face mesh visualization.

**Detections:**
- 7 Emotions: Neutral, Happy, Surprise, Angry, Disgust, Fear, Sad
- Facial mesh tracking overlay
- Micro-expression analysis
- Gaze direction and eye contact
- Head pose and orientation

---

## 🔧 API Reference

### Endpoints

#### `POST /api/analyze`
Upload and analyze static media files.

**Request:**
- `Content-Type: multipart/form-data`
- `file`: Image, video, or audio file (max 50MB)

**Response:**
```json
{
  "id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "type": "file",
  "fileName": "interview.jpg",
  "mimeType": "image/jpeg",
  "analysis": {
    "overallScore": 85,
    "summary": "Excellent professional presence...",
    "posture": {...},
    "facial": {...},
    "gestures": {...},
    "recommendations": [...]
  }
}
```

#### `GET /api/history`
Retrieve analysis history for the current device.

**Query Parameters:**
- `deviceId`: UUID stored in localStorage

**Response:**
```json
{
  "analyses": [...]
}
```

---

## 🎯 Key Design Decisions

### Hybrid Processing Model
- **Server-side AI (Gemini)**: Comprehensive interpretation and actionable insights
- **Client-side ML (TensorFlow.js)**: Real-time visual feedback without latency

### Stateless Backend
- Designed for serverless deployment on Replit
- No persistent database required for core functionality
- Easy horizontal scaling

### Device-Based History
- Uses localStorage with UUID for tracking
- No mandatory authentication
- Privacy-focused design

### Component-First Architecture
- Modular Shadcn UI components
- Consistent theming (light/dark mode)
- Reusable atomic design patterns

### Type Safety
- End-to-end TypeScript
- Zod runtime validation
- Shared schema definitions

---

## 🛠️ Development

### Available Scripts

```bash
npm run dev       # Start development server (port 5000)
npm run build     # Build for production
npm start         # Start production server
npm run check     # TypeScript type checking
npm run db:push   # Push database schema (if using PostgreSQL)
```

### Environment Variables

```env
# Required
GEMINI_API_KEY=your_gemini_api_key

# Optional (for PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database
```

### Model Preloading

Models are automatically cached in localStorage for faster subsequent loads:
- MoveNet (pose detection)
- MediaPipe FaceMesh (facial landmarks)
- Face-API.js models (emotion recognition)

### Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ⚠️ Requires WebGL support for optimal performance

---

## 📊 Performance Optimization

- **Client-side ML**: TensorFlow.js with WebGL backend for GPU acceleration
- **Model Caching**: Persistent storage in localStorage
- **Lazy Loading**: Components and models loaded on-demand
- **Code Splitting**: Vite-powered automatic code splitting
- **Image Optimization**: Responsive images with modern formats

---

## 🔐 Security & Privacy

- **No Data Persistence**: Analysis data stored in-memory only
- **Device-Local History**: No server-side user tracking
- **Secure API Keys**: Environment variables for sensitive credentials
- **Client-Side Processing**: Most ML inference happens locally

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Gemini AI** - Comprehensive body language interpretation
- **TensorFlow.js Team** - Client-side machine learning framework
- **Shadcn UI** - Beautiful, accessible component system
- **Radix UI** - Unstyled, accessible primitives
- **Replit** - Deployment platform and development environment

---

## 📧 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/gestyx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/gestyx/discussions)
- **Email**: support@gestyx.app

---

<div align="center">

**Built with ❤️ using React, TypeScript, and TensorFlow.js**

[⬆ Back to Top](#gestyx---ai-powered-body-language-analysis-platform)

</div>

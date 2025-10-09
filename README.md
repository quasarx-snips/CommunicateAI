# ComposureSense - AI Body Language Analysis

## Overview

ComposureSense is an AI-powered application designed to provide real-time feedback on body language, including posture, facial expressions, and non-verbal communication. It leverages Google's Gemini AI for comprehensive interpretation and TensorFlow.js for real-time, client-side pose and facial landmark detection. The project aims to offer diverse analysis modes for static media and live webcam feeds, catering to various use cases from general composure feedback to specialized modes for security, education, and interviews, ultimately enhancing self-awareness and communication skills.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, using Vite for fast development. It features Shadcn UI (New York style) based on Radix UI and Tailwind CSS for a robust, themeable component system with dark mode support. State management relies on TanStack React Query for server state and local React hooks for component state. Wouter handles client-side routing.

Key pages include:
- **Home**: For uploading static media (images, videos).
- **Live Analysis**: Offers real-time webcam analysis with two core modes:
    - **Composure Mode**: Focuses on posture, gesture recognition, and body alignment.
    - **Expressions Mode**: Detects facial expressions, emotions, age, gender, and visualizes face meshes.
- **Results**: Displays detailed analysis.
- **History**: Stores device-specific analysis history locally.

Client-side real-time processing is powered by TensorFlow.js (WebGL/CPU backends) for pose detection (MoveNet) and facial landmark detection (MediaPipe FaceMesh), ensuring immediate visual feedback without server round-trips.

### Backend Architecture

The backend utilizes Node.js with Express.js and TypeScript. It provides RESTful endpoints for media uploads and analysis retrieval. File handling uses Multer for multipart form data, with in-memory storage. The server is designed to be stateless, making it suitable for serverless deployment, and uses a hybrid processing model by offloading comprehensive AI interpretation to Google Gemini while managing client-side real-time processing.

### Data Storage Solutions

Currently, data is stored in-memory using `Map` objects. While a PostgreSQL schema using Drizzle ORM is defined for `users` and `analyses` tables, no persistent database is actively connected. Client-side analysis history is tracked per device using a UUID stored in `localStorage`, maintaining privacy without requiring user authentication.

### Key Architectural Decisions

- **Hybrid Processing Model**: Balances server-side AI for comprehensive insights (Gemini) with client-side ML for real-time feedback (TensorFlow.js).
- **Stateless Backend**: Designed for scalability and serverless compatibility, with an interchangeable storage interface.
- **Device-based History**: Offers a frictionless user experience by tracking history via `localStorage` without explicit authentication.
- **Component-first Design**: Employs a consistent UI/UX with Shadcn UI, supporting both light and dark themes.
- **Type Safety**: Achieved end-to-end using TypeScript and Zod for schema validation.
- **Modular Analysis Modes**: Supports distinct live analysis modes optimized for different use cases:
    - **Static Upload Mode**: Comprehensive body language analysis via Gemini AI.
    - **Live Composure Mode**: Client-side posture and gesture analysis with advanced biomechanics.
    - **Live Expressions Mode**: Client-side facial expression and emotion recognition with face mesh visualization.
    - **Advanced Face Analysis System**: Integrated across modes for head movement, gaze, eye aspect ratio, micro-expression, and energy level tracking.

## External Dependencies

### AI/ML Services

- **Google Gemini AI**: For comprehensive body language interpretation of uploaded media.
- **face-api.js**: Browser-based face detection and emotion recognition (local processing).
- **TensorFlow.js**: Client-side ML inference with WebGL and CPU backends.
- **TensorFlow Models**: Pre-trained models like MoveNet for pose detection.

### Database (Prepared, not actively used)

- **Neon Database**: Serverless PostgreSQL.
- **Drizzle ORM**: Type-safe ORM for schema definition.

### UI Framework Components

- **Radix UI**: Accessible, unstyled UI primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

### Form Handling

- **React Hook Form**: For form state management.
- **Zod**: Schema validation.

### Build Tools

- **Vite**: Frontend bundler and dev server.
- **esbuild**: Backend bundling.
- **TSX**: TypeScript execution for development.

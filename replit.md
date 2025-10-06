# ComposureSense - AI Body Language Analysis

## Overview

ComposureSense is an AI-powered body language analysis application that provides real-time feedback on posture, facial expressions, and non-verbal communication patterns. The application supports multiple analysis modes including static image/video analysis, live webcam analysis, and facial expression detection. It uses Google's Gemini AI for comprehensive body language interpretation and TensorFlow.js models for real-time pose and facial landmark detection.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: Shadcn UI (New York style variant) built on Radix UI primitives with Tailwind CSS for styling. The design system includes a comprehensive set of reusable components with built-in dark mode support via a theme provider.

**State Management**: TanStack React Query for server state management and caching. No global state library is used; component state is managed locally with React hooks.

**Routing**: Wouter for client-side routing, providing a lightweight alternative to React Router.

**Key Pages**:
- Home: Upload interface for images, videos, or audio files
- Live Analysis: Real-time webcam analysis with **two distinct modes**:
  - **Composure Mode**: Posture analysis with gesture recognition, body alignment metrics, and live feedback
  - **Expressions Mode**: Facial expression recognition with emotion percentages (Neutral, Happy, Surprise, Angry, Disgust, Fear, Sad), age estimation, gender detection, and face mesh visualization with bounding box overlay
- Results: Detailed analysis results display with metrics, insights, and recommendations
- History: Device-specific analysis history stored locally

**Real-time Processing**: TensorFlow.js integration with both WebGL and CPU backends for client-side ML inference. Supports:
- Pose detection (MoveNet model) for body language analysis in Composure mode
- Face landmarks detection (MediaPipe FaceMesh) for facial mesh visualization in Expressions mode
- Live analysis without server round-trips for real-time visual feedback

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Language**: TypeScript with ES modules

**API Design**: RESTful endpoints for file uploads and analysis retrieval

**Key Endpoints**:
- `POST /api/analyze` - Full analysis of uploaded media files
- `POST /api/analyze-expressions` - Facial expression analysis
- `POST /api/analyze-live` - Lightweight live frame analysis
- `GET /api/analysis/:id` - Retrieve specific analysis
- `GET /api/analyses/device/:deviceId` - Get device history
- `DELETE /api/analyses/device/:deviceId` - Clear device history

**File Handling**: Multer middleware for multipart form data with 50MB file size limit and in-memory storage.

**Development Setup**: Vite dev server integrated in middleware mode during development for HMR support.

### Data Storage Solutions

**Primary Storage**: In-memory storage using Map data structures (MemStorage class). No persistent database is currently connected, though the schema is prepared for PostgreSQL with Drizzle ORM.

**Database Schema** (Drizzle ORM with PostgreSQL target):
- `users` table: Authentication support with username/password
- `analyses` table: Stores analysis results with JSONB for flexible result structures

**Client-side Storage**: LocalStorage for device identification (UUID) to track analysis history per device.

**Session Management**: No authentication is currently implemented; device ID serves as the primary identifier for history tracking.

### External Dependencies

**AI/ML Services**:
- **Google Gemini AI**: Core analysis engine for interpreting body language, facial expressions, and providing detailed feedback. Uses the `@google/genai` SDK with vision capabilities for analyzing uploaded images and videos.
- **TensorFlow.js**: Client-side ML inference with multiple backends (@tensorflow/tfjs-core, tfjs-backend-webgl, tfjs-backend-cpu)
- **TensorFlow Models**: Pre-trained models for pose detection (@tensorflow-models/pose-detection) and facial landmarks (@tensorflow-models/face-landmarks-detection)
- **MediaPipe Pose**: Alternative pose estimation library for enhanced accuracy

**Database** (Prepared but not actively used):
- **Neon Database**: PostgreSQL serverless database using `@neondatabase/serverless` driver
- **Drizzle ORM**: Type-safe ORM for database operations with schema-first approach

**UI Framework Components**:
- **Radix UI**: Comprehensive set of accessible, unstyled UI primitives
- **Tailwind CSS**: Utility-first CSS framework with custom theme configuration
- **Lucide React**: Icon library

**Form Handling**:
- **React Hook Form**: Form state management
- **Zod**: Schema validation with `drizzle-zod` for type-safe form schemas

**Build Tools**:
- **Vite**: Frontend bundler and dev server
- **esbuild**: Backend bundling for production
- **TSX**: TypeScript execution for development

**Development Tooling**:
- **Replit Plugins**: Development banner, cartographer, and runtime error modal for Replit environment integration

### Key Architectural Decisions

**Hybrid Processing Model**: The application uses both server-side AI analysis (Gemini) for comprehensive insights and client-side ML (TensorFlow.js) for real-time feedback. This approach balances accuracy with responsiveness—detailed analysis happens on the backend while live tracking runs entirely in the browser.

**Stateless Backend**: The server is designed to be stateless with in-memory storage, making it suitable for serverless deployment. The MemStorage implementation can be easily swapped for a database-backed solution by implementing the IStorage interface.

**Device-based History**: Instead of user accounts, the application tracks analysis history per device using a UUID stored in localStorage. This provides a frictionless experience without requiring authentication while still maintaining user privacy.

**Component-first Design**: The UI is built with a comprehensive design system using Shadcn UI patterns. All components support both light and dark themes and follow consistent spacing, border radius, and color conventions defined in the Tailwind configuration.

**Type Safety**: End-to-end type safety is maintained using TypeScript with shared schema definitions (Zod) between frontend and backend. Database schemas are generated from Drizzle ORM definitions.

**Modular Analysis Modes**: The application supports multiple analysis modes with mode-specific optimizations:
- **Static Upload Mode**: Comprehensive body language analysis of images, videos, or audio files using Gemini AI for detailed insights
- **Live Composure Mode**: Real-time posture and gesture analysis using TensorFlow.js pose detection with periodic Gemini feedback
- **Live Expressions Mode**: Real-time facial expression recognition with emotion percentages, age estimation, and face mesh visualization. Uses MediaPipe FaceMesh for client-side landmark detection and Gemini AI for emotion analysis every 3 seconds
- Each mode features robust error handling that clears stale data and provides user feedback through toast notifications when analysis fails
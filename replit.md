# ComposureSense - AI Body Language Analysis

## Overview

ComposureSense is an AI-powered web application that provides real-time feedback on body language, posture, facial expressions, and non-verbal communication. The application supports both static media analysis (images/videos) and live webcam analysis with multiple specialized modes for different use cases like education, interviews, and general composure assessment.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript and Vite for fast development
- Shadcn UI (New York style) with Radix UI primitives and Tailwind CSS
- Wouter for client-side routing
- TanStack Query for data fetching and caching

**Key Design Decisions:**

1. **Component-First Design**: Uses a modular component system with Shadcn UI for consistent, themeable UI across light and dark modes. All components follow atomic design principles with reusable primitives.

2. **Client-Side ML Processing**: Leverages TensorFlow.js with WebGL/CPU backends for real-time analysis without server round-trips:
   - **MoveNet** for pose detection and body alignment
   - **MediaPipe FaceMesh** for facial landmark detection
   - **Face-API.js** for emotion recognition and facial analysis

3. **Multiple Analysis Modes**:
   - **Static Upload Mode**: Comprehensive analysis via Gemini AI for uploaded images/videos
   - **Live Composure Mode**: Real-time posture and gesture analysis with biomechanics tracking
   - **Live Expressions Mode**: Facial expression and emotion recognition with face mesh visualization
   - **Education Mode**: Attention and engagement metrics for learning scenarios
   - **Interview Mode**: Confidence and professionalism assessment

4. **Model Preloading Strategy**: Implements intelligent caching and lazy loading of ML models with cache status tracking in localStorage to minimize initial load times and provide immediate feedback on model availability.

5. **Device-Based History**: Uses localStorage with UUID-based device IDs to track analysis history without requiring user authentication, providing a frictionless experience.

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js and TypeScript
- Google Gemini AI for comprehensive body language analysis
- Multer for multipart form data handling with in-memory storage

**Key Design Decisions:**

1. **Stateless Design**: Backend is designed to be stateless and serverless-compatible, with no persistent database connections required for core functionality.

2. **Hybrid Processing Model**: Balances server-side AI (Gemini) for comprehensive insights with client-side ML for real-time feedback, optimizing for both accuracy and responsiveness.

3. **Interchangeable Storage Interface**: Defines an `IStorage` interface with in-memory implementation (`MemStorage`) that can be swapped for persistent storage (PostgreSQL with Drizzle ORM) without code changes.

4. **Simplified Live Analysis**: Provides lightweight endpoints for live frame analysis with reduced response payloads optimized for real-time display.

### Data Storage Solutions

**Current Implementation:**
- In-memory storage using JavaScript `Map` objects for temporary data persistence
- Client-side localStorage for device identification and history tracking

**Future-Ready Design:**
- Database schema defined using Drizzle ORM for PostgreSQL
- Tables: `users`, `analyses`, `live_sessions`
- Schema includes support for device-based tracking and JSON storage of analysis results

**Why This Approach:**
- Enables immediate deployment without database setup
- Reduces infrastructure complexity for development and testing
- Allows seamless migration to persistent storage when needed

### Authentication and Authorization

**Current State**: No authentication required - uses anonymous device-based tracking

**Design Philosophy**: Prioritizes user experience and privacy by avoiding mandatory sign-ups while maintaining the ability to track individual device history locally.

## External Dependencies

### AI/ML Services
- **Google Gemini AI** (`@google/genai`): Server-side comprehensive body language analysis with advanced prompting for posture, facial expressions, and gesture recognition
- **TensorFlow.js** (`@tensorflow/tfjs-*`): Client-side ML framework with WebGL and CPU backend support
- **TensorFlow Models**: 
  - `@tensorflow-models/pose-detection`: MoveNet for pose and body alignment analysis
  - `@tensorflow-models/face-landmarks-detection`: MediaPipe FaceMesh for facial landmark tracking
- **Face-API.js** (`@vladmandic/face-api`): Emotion recognition and facial expression analysis

### UI/UX Libraries
- **Radix UI** (`@radix-ui/*`): Unstyled, accessible component primitives for dialogs, dropdowns, tabs, etc.
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide React**: Icon library for consistent visual elements

### Database & Backend
- **Drizzle ORM** (`drizzle-orm`, `drizzle-kit`): Type-safe ORM for PostgreSQL (schema defined, not actively connected)
- **Neon Database** (`@neondatabase/serverless`): Serverless PostgreSQL driver (optional, for future use)

### Developer Experience
- **Vite**: Fast build tool and dev server
- **TypeScript**: End-to-end type safety
- **Zod**: Runtime schema validation
- **React Hook Form** with resolvers for form validation

### File Processing
- **Multer**: Multipart form data handling with in-memory storage (50MB limit)
- Support for images and videos with MIME type validation
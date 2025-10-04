# PostureSense - AI Body Language Analysis Application

## Overview

PostureSense is a multimodal communication analysis application that uses AI to analyze body language, posture, facial expressions, and vocal dynamics from uploaded images, videos, and audio files. The application provides users with comprehensive feedback including overall scores, detected features, strengths, areas for improvement, and actionable recommendations to enhance their communication skills.

The application features a clean, professional interface built with React and shadcn/ui components, backed by an Express.js server that integrates with Google's Gemini AI for analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management
- Tailwind CSS for utility-first styling
- shadcn/ui component library (Radix UI primitives) for accessible, pre-styled components

**Design System:**
- Custom color palette with HSL color tokens defined in CSS variables
- Professional blue primary color (210 85% 45%) for headers and primary actions
- Inter font family for typography
- Consistent spacing units using Tailwind's spacing scale
- Responsive layout with max-width containers (max-w-6xl)
- Single-column layout prioritizing clarity and focus

**State Management:**
- React Query handles all server state (analysis results, API calls)
- Local component state with React hooks for UI interactions
- Toast notifications for user feedback on actions

**Routing:**
- `/` - Home page with upload interface
- `/results/:id` - Analysis results display page
- Catch-all 404 page for unmatched routes

### Backend Architecture

**Technology Stack:**
- Node.js with Express.js for the HTTP server
- TypeScript for type safety across the stack
- Drizzle ORM for database abstraction
- Google Gemini AI (gemini-2.0-flash-exp model) for multimodal analysis
- Multer for handling file uploads (up to 50MB)

**API Design:**
- RESTful endpoint structure
- `POST /api/analyze` - Upload and analyze files (images/video/audio)
- `GET /api/analysis/:id` - Retrieve specific analysis results
- `GET /api/analyses` - List all analyses
- JSON responses with consistent error handling

**Data Flow:**
1. Client uploads file via multipart/form-data
2. Server receives file in memory buffer
3. File sent to Gemini AI with structured prompt for analysis
4. AI returns JSON-formatted analysis results
5. Results stored in database with unique ID
6. Client receives analysis ID and redirects to results page

**Storage Layer:**
- In-memory storage implementation (`MemStorage`) for development
- Designed for easy swapping with persistent database storage
- Drizzle ORM configured for PostgreSQL (via Neon Database)
- Schema defines `users` and `analyses` tables
- Analysis results stored as JSONB for flexible querying

**AI Integration:**
- Google Gemini AI integration via `@google/genai` package
- Multimodal analysis supporting images, video, and audio
- Structured prompt engineering for consistent analysis format
- JSON schema validation for response format
- Analyzes: vocal dynamics, kinetic/postural features, communication cohesion
- Returns: scores, detections, strengths, improvements, recommendations, metrics

### Data Storage Solutions

**Database Configuration:**
- PostgreSQL as the target production database
- Neon Database serverless Postgres for cloud deployment
- Drizzle ORM for type-safe database queries and migrations
- Migration files stored in `/migrations` directory

**Schema Design:**
- `users` table: id (UUID), username, password
- `analyses` table: id (UUID), fileName, fileType, result (JSONB), createdAt
- Analysis results use Zod schemas for runtime validation
- Strong typing between database and application layer

**Current Implementation:**
- In-memory storage for rapid development and testing
- Production-ready database configuration via `DATABASE_URL` environment variable
- Drizzle schema shared between client and server via `/shared` directory

### External Dependencies

**AI Services:**
- Google Gemini AI API (gemini-2.0-flash-exp model)
- API key required via `GEMINI_API_KEY` environment variable
- Handles image, video, and audio analysis
- Returns structured JSON with analysis results

**Database Services:**
- Neon Database (PostgreSQL-compatible serverless database)
- Connection via `DATABASE_URL` environment variable
- Managed through Drizzle ORM

**UI Component Library:**
- Radix UI primitives for accessible components
- shadcn/ui configuration for component styling
- Extensive component library (40+ components) including dialogs, dropdowns, forms, navigation

**Development Tools:**
- Vite plugins for development experience (error overlay, dev banner, cartographer)
- TypeScript for type checking
- ESBuild for production bundling

**Frontend Libraries:**
- React Hook Form with Zod resolvers for form validation
- Lucide React for icon components
- date-fns for date formatting
- class-variance-authority for component variants
- clsx and tailwind-merge for className utilities
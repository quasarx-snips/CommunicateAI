# Gestyx - Complete Developer's Guide 🚀

## Welcome, Future Developer! 👋

This guide will take you from **zero coding experience** to understanding how a **real-world AI application** works. By the end, you'll understand web development, AI integration, and modern software architecture.

---

## 📚 Table of Contents

1. [What is This Application?](#what-is-this-application)
2. [The Big Picture - How It All Works](#the-big-picture)
3. [Technology Stack Explained](#technology-stack-explained)
4. [Project Structure - Every File Explained](#project-structure)
5. [How Data Flows Through The App](#data-flow)
6. [Key Concepts You Need to Know](#key-concepts)
7. [Deep Dive - File by File](#file-by-file-breakdown)
8. [How to Run and Test](#how-to-run)
9. [Learning Path - What to Study Next](#learning-path)

---

## 1. What is This Application? 🎯

**Gestyx** is an AI-powered web application that analyzes body language in real-time or from uploaded images/videos. Think of it as a personal coach that gives you feedback on:

---

## 2. The Big Picture - How It All Works 🖼️

Gestyx is a full-stack web application with these main parts:

1.  **Frontend (Client):** Built with React and TypeScript. Runs in the user's browser. Handles user input, displays results, and performs real-time analysis using TensorFlow.js.
2.  **Backend (Server):** Built with Node.js, Express, and TypeScript. Handles API requests, interacts with AI models (Gemini), and stores data.
3.  **AI Models:**
    *   **TensorFlow.js:** Runs in the browser for real-time pose and face detection.
    *   **Google Gemini:** Cloud-based AI for analyzing uploaded images/videos.

---

## 3. Technology Stack Explained 💻

*   **Frontend:**
    *   **React:** Component-based UI library.
    *   **TypeScript:** Adds static typing to JavaScript for better safety.
    *   **Wouter:** Minimalist routing library.
    *   **React Query:** Efficient data fetching and state management.
    *   **Tailwind CSS:** Utility-first CSS framework for rapid styling.
    *   **TensorFlow.js:** JavaScript library for machine learning in the browser.
    *   **face-api.js:** JavaScript library for face detection and recognition.
*   **Backend:**
    *   **Node.js:** JavaScript runtime environment.
    *   **Express:** Web application framework for Node.js.
    *   **TypeScript:** For server-side type safety.
    *   **Multer:** Middleware for handling file uploads.
    *   **@google/generative-ai:** Official Google SDK for Gemini API.
    *   **dotenv:** Loads environment variables from `.env` file.
*   **Shared:**
    *   **Zod:** TypeScript-first schema declaration and validation library.

---

## 4. Project Structure - Every File Explained 📁

```
Gestyx/
├── client/         # Frontend React app
│   ├── public/     # Static assets (index.html, models)
│   ├── src/
│   │   ├── components/ # Reusable UI elements (Button, etc.)
│   │   ├── pages/      # Main page components (Home, LiveAnalysis, etc.)
│   │   ├── lib/        # Utility functions and classes (modelLoader, etc.)
│   │   ├── App.tsx     # Main application component, routing, providers
│   │   └── index.tsx   # Entry point, renders App
│   ├── index.html
│   └── ...
├── server/         # Backend Node.js app
│   ├── models/     # AI models (for TensorFlow.js)
│   ├── routes/     # API endpoint definitions
│   ├── types/      # TypeScript type definitions
│   ├── index.ts    # Server entry point, Express setup
│   ├── gemini.ts   # Gemini AI integration
│   ├── storage.ts  # In-memory data storage
│   ├── routes.ts   # API route registration
│   └── ...
├── shared/         # Code shared between client & server
│   └── schema.ts   # Data validation schemas (Zod)
├── .env            # Environment variables (API keys, etc.)
├── .gitignore
├── package.json
├── tsconfig.json   # TypeScript configuration
└── ...
```

---

## 5. How Data Flows Through The App 🌊

1.  **Upload Image/Video:** User selects a file on the **Home** page (`client/src/pages/Home.tsx`).
2.  **Send to Backend:** The file is sent to the `/api/analyze` endpoint on the server (`server/routes.ts`).
3.  **AI Analysis:** The backend receives the file, sends it to the **Gemini API** (`server/gemini.ts`) for analysis.
4.  **Store Result:** The analysis result is stored in memory (`server/storage.ts`).
5.  **Return to Frontend:** The server sends the analysis ID back to the client.
6.  **Display Results:** The client navigates to the `/results/:id` page and fetches the analysis data to display it.

**Real-time Analysis:**
1.  User navigates to the **Live Analysis** page (`client/src/pages/LiveAnalysis.tsx`).
2.  **Camera Access:** The browser requests camera permission.
3.  **Local Analysis:** TensorFlow.js and face-api.js (loaded via `modelLoader.ts`) process the video stream *in the browser*.
4.  **Display Overlay:** Keypoints and facial expressions are drawn onto a canvas overlaying the video feed.

---

## 6. Key Concepts You Need to Know 🔑

### A) State Management in React

*   **`useState`:** For managing local component state (e.g., a form input value).
*   **`useEffect`:** For handling side effects (e.g., data fetching, subscriptions) after component renders.
*   **`useRef`:** For accessing DOM elements directly or persisting mutable values across renders without causing re-renders.
*   **React Query:** For global state management, caching, and synchronizing server data.

### B) Components in React

A component is a reusable piece of UI. Example:

```typescript
function Button({ text, onClick }) {
  return (
    <button onClick={onClick} className="bg-blue-500 text-white px-4 py-2">
      {text}
    </button>
  );
}

<Button text="Analyze" onClick={handleAnalyze} />
<Button text="Upload" onClick={handleUpload} />
```

### C) Routing with Wouter

`wouter` handles navigation between different "pages" in your single-page application.

```typescript
import { Switch, Route } from "wouter";

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/live" component={LiveAnalysis} />
      <Route path="/results/:id" component={ResultsPage} />
    </Switch>
  );
}
```

### D) Asynchronous Operations

Some tasks take time (like uploading a file or waiting for AI analysis). JavaScript handles this with:

**Promises & async/await:**

```typescript
uploadFile(file).then(result => {
  console.log(result);
}).catch(error => {
  console.error(error);
});

try {
  const result = await uploadFile(file);
  console.log(result);
} catch (error) {
  console.error(error);
}
```

### E) TypeScript & Zod

*   **TypeScript:** Provides static typing, catching errors before runtime.
*   **Zod:** Used for defining data schemas (`shared/schema.ts`). Ensures data sent between client and server has the correct shape and types.

---

## 7. Deep Dive - File by File 🔍

#### **client/src/App.tsx** - The App's Skeleton

```typescript
import { Switch, Route } from "wouter";

function App() {
  return (
    <QueryClientProvider>
      <ThemeProvider>
        <TooltipProvider>
          <Router />
          <ModelPreloader />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

**What it does:**
*   Wraps the entire app in "providers" (think of them as power sources)
*   Each provider gives special abilities to all components inside it
*   Sets up navigation between pages

#### **client/src/pages/Home.tsx** - Landing Page

```typescript
function Home() {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    const formData = new FormData();
    formData.append('file', file);

    const result = await fetch('/api/analyze', {
      method: 'POST',
      body: formData
    });

    navigate(`/results/${result.id}`);
  };

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Analyze</button>
    </div>
  );
}
```

**Flow:**
1.  User selects file → stored in `file` state
2.  User clicks "Analyze" → file sent to backend
3.  Backend returns analysis ID → redirect to `/results/{id}`

#### **client/src/pages/LiveAnalysis.tsx** - Real-Time Magic

```typescript
function LiveAnalysis() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        videoRef.current.srcObject = stream;
      });

    const detector = await poseDetection.createDetector(...);

    const analyze = async () => {
      const poses = await detector.estimatePoses(videoRef.current);
      drawKeypoints(poses, canvasRef.current);

      requestAnimationFrame(analyze);
    };
    analyze();
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay />
      <canvas ref={canvasRef} />
    </div>
  );
}
```

**How it works:**
1.  Requests camera permission
2.  Streams video to `<video>` element
3.  Every frame: TensorFlow detects 17 body keypoints
4.  Draws skeleton overlay on canvas
5.  Calculates metrics (posture angle, symmetry, etc.)

#### **client/src/lib/modelLoader.ts** - AI Model Preloader

```typescript
class ModelLoader {
  private poseDetector: any = null;
  private faceApiLoaded: boolean = false;

  async initialize() {
    this.poseDetector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      { modelType: 'SinglePose.Lightning' }
    );

    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceExpressionNet.loadFromUri('/models');

    this.faceApiLoaded = true;

    console.log('✅ Models loaded!');
  }

  getDetector() {
    return this.poseDetector;
  }
}

export const modelLoader = new ModelLoader();
```

**Why preload?**
*   Models are 10-50 MB files
*   Loading takes 2-5 seconds
*   Do it once at startup = instant analysis later

#### **server/index.ts** - Server Entry Point

```typescript
const app = express();

app.use(express.json());
app.use(express.urlencoded(...));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

await registerRoutes(app);

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
```

**What happens:**
1.  Express app created
2.  Middleware added (logging, JSON parsing)
3.  Routes registered (`/api/analyze`, `/api/analysis/:id`, etc.)
4.  Server starts listening on port 5000
5.  Ready to receive requests!

#### **server/routes.ts** - API Endpoints

```typescript
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  const { buffer, mimetype, originalname } = req.file;

  const analysisResult = await analyzeBodyLanguage(buffer, mimetype, originalname);

  const analysis = await storage.createAnalysis({
    fileName: originalname,
    fileType: mimetype,
    result: analysisResult,
    deviceId: req.body.deviceId
  });

  res.json(analysis);
});

app.get("/api/analysis/:id", async (req, res) => {
  const analysis = await storage.getAnalysis(req.params.id);
  res.json(analysis);
});

app.get("/api/analyses/device/:deviceId", async (req, res) => {
  const analyses = await storage.getAnalysesByDevice(req.params.deviceId);
  res.json(analyses);
});
```

**Understanding HTTP Methods:**
*   `GET`: Retrieve data (like reading a book)
*   `POST`: Send data (like mailing a letter)
*   `PUT`: Update data (like editing a document)
*   `DELETE`: Remove data (like throwing away paper)

#### **server/gemini.ts** - AI Integration

```typescript
import { GoogleGenerativeAI } from "@google/genai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function analyzeBodyLanguage(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<AnalysisResult> {

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Analyze this image for body language. Evaluate:
    1. Posture and alignment
    2. Facial expressions
    3. Hand gestures
    4. Overall confidence

    Provide a score (0-100) and detailed feedback.
  `;

  const result = await model.generateContent([
    {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType: mimeType
      }
    },
    prompt
  ]);

  const text = result.response.text();
  const analysis = JSON.parse(text);

  return analysis;
}
```

**How it works:**
1.  Take uploaded file (as binary Buffer)
2.  Convert to base64 string (text representation of binary)
3.  Send to Gemini along with analysis instructions
4.  Gemini returns JSON with scores, feedback, recommendations
5.  Return structured data to frontend

#### **server/storage.ts** - In-Memory Database

```typescript
const analyses = new Map<string, Analysis>();

export const storage = {

  async createAnalysis(data: InsertAnalysis): Promise<Analysis> {
    const id = crypto.randomUUID();
    const analysis = {
      id,
      ...data,
      createdAt: new Date()
    };

    analyses.set(id, analysis);
    return analysis;
  },

  async getAnalysis(id: string): Promise<Analysis | undefined> {
    return analyses.get(id);
  },

  async getAnalysesByDevice(deviceId: string): Promise<Analysis[]> {
    return Array.from(analyses.values())
      .filter(a => a.deviceId === deviceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async clearDeviceHistory(deviceId: string): Promise<number> {
    const toDelete = Array.from(analyses.entries())
      .filter(([_, a]) => a.deviceId === deviceId);

    toDelete.forEach(([id]) => analyses.delete(id));
    return toDelete.length;
  }
};
```

**Why Map instead of a real database?**
*   Simple for prototyping
*   No setup required
*   Fast for small datasets
*   **Downside**: Data lost when server restarts

#### **shared/schema.ts** - Data Structures

```typescript
import { z } from "zod";

export const analysisResultSchema = z.object({
  score: z.string(),
  rating: z.enum(["excellent", "good", "fair", "poor"]),
  description: z.string(),
  detections: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string()
  })),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  recommendations: z.array(z.string()),
  metrics: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string()
  }))
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
```

**Why use Zod?**
*   Validates data at runtime (catches bugs)
*   Auto-generates TypeScript types
*   Both frontend and backend use same definitions
*   Prevents data mismatches

---

## 8. How to Run and Test 🚀

1.  **Install Dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
2.  **Configure Environment:** Create a `.env` file in the root directory and add your Gemini API key:
    ```
    GEMINI_API_KEY=YOUR_API_KEY_HERE
    ```
3.  **Start Backend:**
    ```bash
    npm run dev:server
    # or
    yarn dev:server
    ```
4.  **Start Frontend:** In a separate terminal:
    ```bash
    npm run dev:client
    # or
    yarn dev:client
    ```
5.  **Open Browser:** Go to `http://localhost:5173` (or the port your frontend is running on).

---

## 9. Learning Path - What to Study Next 📚

*   **JavaScript Fundamentals:** [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
*   **React:** [Official React Docs](https://react.dev/)
*   **TypeScript:** [Official TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
*   **Node.js & Express:** [Express.js Website](https://expressjs.com/)
*   **Machine Learning Concepts:** [Google's Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)
*   **TensorFlow.js:** [TensorFlow.js Website](https://www.tensorflow.org/js)
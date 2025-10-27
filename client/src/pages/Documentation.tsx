
import { useState } from "react";
import { Book, Code, ArrowLeft, FileText } from "lucide-react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Documentation() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Book className="w-8 h-8 text-primary-foreground" strokeWidth={2} />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Documentation
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Learn about Gestyx's features, architecture, and how to use the platform
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="learn" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Developer Guide
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="bg-card border border-card-border rounded-xl p-6 sm:p-8">
              <ScrollArea className="h-[600px] pr-4">
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent mb-4">
                        Gestyx
                      </h1>
                      <p className="text-xl text-muted-foreground">
                        AI-Powered Body Language Analysis Platform
                      </p>
                      <div className="flex justify-center gap-2 mt-4 flex-wrap">
                        <span className="inline-block px-3 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                          TypeScript 5.6
                        </span>
                        <span className="inline-block px-3 py-1 text-xs font-semibold bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200 rounded-full">
                          React 18.3
                        </span>
                        <span className="inline-block px-3 py-1 text-xs font-semibold bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full">
                          TensorFlow.js 4.22
                        </span>
                      </div>
                    </div>

                    <section className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-6">
                      <h2 className="text-2xl font-bold text-foreground mb-3 flex items-center gap-2">
                        🎯 Overview
                      </h2>
                      <p className="text-muted-foreground leading-relaxed">
                        Gestyx is an advanced AI-powered web application that provides comprehensive real-time feedback on body language, facial expressions, posture, and non-verbal communication. Built with cutting-edge machine learning models, Gestyx empowers users to improve their communication skills for interviews, presentations, education, and professional development.
                      </p>
                    </section>

                    <section>
                      <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
                        ✨ Key Features
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Real-Time Analysis</h3>
                          <p className="text-sm text-green-700 dark:text-green-300">Live webcam analysis with instant feedback on posture, expressions, and gestures</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Multiple Modes</h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300">Composure, Expressions, Education, and Interview analysis modes</p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                          <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Static Media Analysis</h3>
                          <p className="text-sm text-purple-700 dark:text-purple-300">Upload images and videos for comprehensive AI-powered insights</p>
                        </div>
                        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                          <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">Privacy-First</h3>
                          <p className="text-sm text-orange-700 dark:text-orange-300">Client-side processing with no authentication required</p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h2 className="text-2xl font-bold text-foreground mb-4">🚀 Technology Stack</h2>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold text-lg text-foreground mb-2">Frontend</h3>
                          <ul className="space-y-1 text-muted-foreground">
                            <li>• React 18.3 with TypeScript for type-safe development</li>
                            <li>• Vite for lightning-fast builds and hot module replacement</li>
                            <li>• Tailwind CSS + Shadcn UI for beautiful, responsive design</li>
                            <li>• TensorFlow.js for client-side machine learning</li>
                            <li>• Face-API.js for facial expression recognition</li>
                          </ul>
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-foreground mb-2">Backend</h3>
                          <ul className="space-y-1 text-muted-foreground">
                            <li>• Node.js with Express and TypeScript</li>
                            <li>• Google Gemini AI for advanced analysis</li>
                            <li>• Multer for file upload handling</li>
                            <li>• In-memory storage with database-ready architecture</li>
                          </ul>
                        </div>
                      </div>
                    </section>

                    <section className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg p-6">
                      <h2 className="text-2xl font-bold text-foreground mb-3">📋 How It Works</h2>
                      <ol className="space-y-3 text-muted-foreground">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</span>
                          <span><strong>Upload or Go Live:</strong> Choose between uploading media files or starting a live analysis session</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</span>
                          <span><strong>AI Processing:</strong> Advanced ML models analyze your body language, facial expressions, and gestures</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</span>
                          <span><strong>Get Insights:</strong> Receive detailed scores, metrics, and actionable recommendations</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</span>
                          <span><strong>Improve:</strong> Use the feedback to enhance your communication skills</span>
                        </li>
                      </ol>
                    </section>

                    <section>
                      <h2 className="text-2xl font-bold text-foreground mb-4">🎓 Use Cases</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <span className="text-2xl">🎤</span>
                          <div>
                            <h4 className="font-semibold">Interview Preparation</h4>
                            <p className="text-sm text-muted-foreground">Practice and refine your professional presence</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <span className="text-2xl">📊</span>
                          <div>
                            <h4 className="font-semibold">Presentation Skills</h4>
                            <p className="text-sm text-muted-foreground">Improve confidence and body language for public speaking</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <span className="text-2xl">👨‍🏫</span>
                          <div>
                            <h4 className="font-semibold">Education</h4>
                            <p className="text-sm text-muted-foreground">Monitor engagement and attention during learning</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <span className="text-2xl">💼</span>
                          <div>
                            <h4 className="font-semibold">Professional Development</h4>
                            <p className="text-sm text-muted-foreground">Enhance non-verbal communication skills</p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="learn" className="space-y-6">
            <div className="bg-card border border-card-border rounded-xl p-6 sm:p-8">
              <ScrollArea className="h-[600px] pr-4">
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <div className="space-y-6">
                    <div className="text-center mb-8">
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                        Complete Developer's Guide
                      </h1>
                      <p className="text-xl text-muted-foreground">
                        From Zero to Understanding Real-World AI Applications
                      </p>
                    </div>

                    <section className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg p-6">
                      <h2 className="text-2xl font-bold text-foreground mb-3">🎯 What You'll Learn</h2>
                      <p className="text-muted-foreground leading-relaxed">
                        This guide takes you from zero coding experience to understanding how a real-world AI application works. You'll learn web development, AI integration, and modern software architecture through practical examples.
                      </p>
                    </section>

                    <section>
                      <h2 className="text-2xl font-bold text-foreground mb-4">📚 Core Concepts</h2>
                      <div className="space-y-4">
                        <div className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                          <h3 className="font-semibold text-lg mb-2">🎨 Frontend Architecture</h3>
                          <p className="text-sm text-muted-foreground mb-2">Component-based design with React and TypeScript</p>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                            <li>• State management with hooks (useState, useEffect, useRef)</li>
                            <li>• Client-side routing with Wouter</li>
                            <li>• Data fetching and caching with React Query</li>
                            <li>• Modern UI with Shadcn and Tailwind CSS</li>
                          </ul>
                        </div>

                        <div className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                          <h3 className="font-semibold text-lg mb-2">🤖 Machine Learning Integration</h3>
                          <p className="text-sm text-muted-foreground mb-2">Client-side and server-side AI processing</p>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                            <li>• TensorFlow.js for real-time pose detection</li>
                            <li>• Face-API.js for facial expression analysis</li>
                            <li>• Google Gemini for comprehensive insights</li>
                            <li>• Model preloading and caching strategies</li>
                          </ul>
                        </div>

                        <div className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                          <h3 className="font-semibold text-lg mb-2">⚙️ Backend Architecture</h3>
                          <p className="text-sm text-muted-foreground mb-2">RESTful API with Express and TypeScript</p>
                          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                            <li>• API endpoint design and routing</li>
                            <li>• File upload handling with Multer</li>
                            <li>• Data validation with Zod schemas</li>
                            <li>• Stateless design for scalability</li>
                          </ul>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h2 className="text-2xl font-bold text-foreground mb-4">🔄 Data Flow</h2>
                      <div className="bg-muted/30 rounded-lg p-6 space-y-4">
                        <div>
                          <h3 className="font-semibold mb-2 text-primary">📤 Upload Analysis Flow</h3>
                          <ol className="space-y-2 text-sm text-muted-foreground ml-4">
                            <li>1. User uploads image/video on Home page</li>
                            <li>2. File sent to /api/analyze endpoint</li>
                            <li>3. Backend processes with Gemini AI</li>
                            <li>4. Results stored and ID returned</li>
                            <li>5. Navigate to /results/:id to display</li>
                          </ol>
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2 text-green-600 dark:text-green-400">📹 Live Analysis Flow</h3>
                          <ol className="space-y-2 text-sm text-muted-foreground ml-4">
                            <li>1. User starts live analysis mode</li>
                            <li>2. Camera permission requested</li>
                            <li>3. TensorFlow.js processes video stream in browser</li>
                            <li>4. Real-time keypoint detection and rendering</li>
                            <li>5. Instant feedback displayed on overlay</li>
                          </ol>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h2 className="text-2xl font-bold text-foreground mb-4">🗂️ Project Structure</h2>
                      <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 overflow-x-auto">
                        <pre className="text-sm text-green-400 font-mono">
{`Gestyx/
├── client/              # Frontend React app
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Route pages
│   │   ├── lib/         # Utilities (API, models)
│   │   └── App.tsx      # Main app component
│   └── index.html
├── server/              # Backend Node.js app
│   ├── routes.ts        # API endpoints
│   ├── gemini.ts        # AI integration
│   ├── storage.ts       # Data persistence
│   └── index.ts         # Server entry
├── shared/              # Shared types/schemas
│   └── schema.ts        # Zod validation
└── package.json`}
                        </pre>
                      </div>
                    </section>

                    <section className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-6">
                      <h2 className="text-2xl font-bold text-foreground mb-4">📖 Learning Path</h2>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center font-bold">1</span>
                          <div>
                            <h4 className="font-semibold">JavaScript Fundamentals</h4>
                            <p className="text-sm text-muted-foreground">Variables, functions, async/await, ES6+ features</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-500 text-white flex items-center justify-center font-bold">2</span>
                          <div>
                            <h4 className="font-semibold">React & TypeScript</h4>
                            <p className="text-sm text-muted-foreground">Components, hooks, props, state management, type safety</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-500 text-white flex items-center justify-center font-bold">3</span>
                          <div>
                            <h4 className="font-semibold">Node.js & Express</h4>
                            <p className="text-sm text-muted-foreground">REST APIs, middleware, routing, request handling</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold">4</span>
                          <div>
                            <h4 className="font-semibold">Machine Learning Basics</h4>
                            <p className="text-sm text-muted-foreground">TensorFlow.js, model loading, inference, computer vision</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h2 className="text-2xl font-bold text-foreground mb-4">🚀 Getting Started</h2>
                      <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-green-400 font-mono text-sm mb-1"># Install dependencies</p>
                          <p className="text-white font-mono text-sm">npm install</p>
                        </div>
                        <div>
                          <p className="text-green-400 font-mono text-sm mb-1"># Set up environment variables</p>
                          <p className="text-white font-mono text-sm">echo "GEMINI_API_KEY=your_key" &gt; .env</p>
                        </div>
                        <div>
                          <p className="text-green-400 font-mono text-sm mb-1"># Start development server</p>
                          <p className="text-white font-mono text-sm">npm run dev</p>
                        </div>
                      </div>
                    </section>

                    <section className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg p-6">
                      <h2 className="text-2xl font-bold text-foreground mb-3">💡 Key Takeaways</h2>
                      <ul className="space-y-2 text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Full-stack development with TypeScript for type safety</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Real-time ML processing in the browser using TensorFlow.js</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>RESTful API design with Express and proper error handling</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Modern UI/UX patterns with component-based architecture</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">✓</span>
                          <span>Privacy-first approach with client-side processing</span>
                        </li>
                      </ul>
                    </section>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

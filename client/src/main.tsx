import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { modelLoader } from "./lib/modelLoader";

// Preload AI models immediately on app load
modelLoader.initialize().catch(err => {
  console.error("Failed to preload AI models:", err);
});

createRoot(document.getElementById("root")!).render(<App />);

import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import ModelPreloader from "@/components/ModelPreloader";
import Home from "@/pages/Home";
import Results from "@/pages/Results";
import History from "@/pages/History";
import LiveAnalysis from "@/pages/LiveAnalysis";
import NotFound from "@/pages/not-found";
import Documentation from "@/pages/Documentation";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/results/:id" component={Results} />
      <Route path="/history" component={History} />
      <Route path="/live" component={LiveAnalysis} />
      <Route path="/docs" component={Documentation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
          <ModelPreloader />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
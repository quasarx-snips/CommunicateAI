import { User, Moon, Sun, History, Activity, Book } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { useLocation } from "wouter";

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-sm">
      <div className="container mx-auto px-4 py-3.5 flex justify-between items-center">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-3 group cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <Activity className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Gestyx
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              AI Body Language Analysis
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/docs")}
            aria-label="View documentation"
            className="h-10 w-10 rounded-lg hover:bg-accent"
            data-testid="button-docs"
          >
            <Book className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/history")}
            aria-label="View history"
            className="h-10 w-10 rounded-lg hover:bg-accent"
            data-testid="button-history"
          >
            <History className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="h-10 w-10 rounded-lg hover:bg-accent"
            data-testid="button-theme-toggle"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
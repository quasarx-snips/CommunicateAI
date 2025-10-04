import { User } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">PostureSense</h1>
            <p className="text-xs text-primary-foreground/80">AI Body Language Analysis</p>
          </div>
        </div>
      </div>
    </header>
  );
}

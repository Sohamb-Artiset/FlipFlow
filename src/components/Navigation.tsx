import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 text-primary-foreground"
              >
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span className="text-xl font-bold text-foreground">FlipFlow</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/product" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Product
            </Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link to="/resources" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Resources
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">
                Log In
              </Button>
            </Link>
            <Link to="/auth?signup=true">
              <Button size="sm">Sign Up</Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

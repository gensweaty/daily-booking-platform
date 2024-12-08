import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const HeroSection = () => {
  return (
    <header className="container mx-auto px-4 py-8">
      <nav className="flex justify-between items-center mb-16">
        <h1 className="text-2xl font-bold text-primary">Taskify Minder</h1>
        <div className="space-x-4">
          <Link to="/login">
            <Button variant="outline">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-primary hover:bg-primary/90">Sign Up Free</Button>
          </Link>
        </div>
      </nav>

      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold leading-tight">
            Your Professional Booking & Task Management Solution
          </h2>
          <p className="text-lg text-muted-foreground">
            Streamline your workflow with our integrated booking calendar, task management, and analytics platform.
          </p>
          <Link to="/signup">
            <Button size="lg" className="bg-primary hover:bg-primary/90">
              Start Your Free Journey
            </Button>
          </Link>
        </div>
        <div className="rounded-lg overflow-hidden shadow-xl">
          <img 
            src="/dashboard-preview.png" 
            alt="Dashboard Preview" 
            className="w-full border border-border rounded-lg shadow-lg"
          />
        </div>
      </div>
    </header>
  );
};
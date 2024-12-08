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
        <div className="space-y-8">
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
        <div className="grid grid-cols-2 gap-4">
          <img 
            src="/lovable-uploads/7c1cf779-ae3c-44e7-bb09-416636a68b72.png" 
            alt="Calendar Preview" 
            className="rounded-lg shadow-lg col-span-2"
          />
          <img 
            src="/lovable-uploads/6ed3a140-619e-4555-8c77-60246cfb2077.png" 
            alt="Analytics Preview" 
            className="rounded-lg shadow-lg"
          />
          <img 
            src="/lovable-uploads/9abedd44-1226-45b3-ab8e-cf31550ffddd.png" 
            alt="Tasks Preview" 
            className="rounded-lg shadow-lg"
          />
        </div>
      </div>
    </header>
  );
};
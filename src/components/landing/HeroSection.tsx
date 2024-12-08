import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";

const productImages = [
  {
    src: "/lovable-uploads/7c1cf779-ae3c-44e7-bb09-416636a68b72.png",
    alt: "Calendar Preview",
  },
  {
    src: "/lovable-uploads/6ed3a140-619e-4555-8c77-60246cfb2077.png",
    alt: "Analytics Preview",
  },
  {
    src: "/lovable-uploads/9abedd44-1226-45b3-ab8e-cf31550ffddd.png",
    alt: "Tasks Preview",
  },
];

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
          <h2 className="text-5xl md:text-6xl font-bold leading-tight">
            Your Professional Booking & Task Management Solution
          </h2>
          <p className="text-xl text-muted-foreground">
            Streamline your workflow with our integrated booking calendar, task management, and analytics platform.
          </p>
          <div className="pt-4">
            <Link to="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Start Your Free Journey
              </Button>
            </Link>
          </div>
        </div>
        <div>
          <ImageCarousel images={productImages} />
        </div>
      </div>
    </header>
  );
};
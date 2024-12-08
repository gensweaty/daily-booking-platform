import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import { ThemeToggle } from "@/components/ThemeToggle";

const productImages = [
  {
    src: "/lovable-uploads/76253e7c-d562-4b00-90f8-906bad45ae0c.png",
    alt: "Task Management Preview",
  },
  {
    src: "/lovable-uploads/7b20b6f1-7c13-47c8-a4f4-ab8373a7b421.png",
    alt: "Statistics Preview",
  },
  {
    src: "/lovable-uploads/bdaf6dc6-c47f-4ea5-af15-5a00b55d1ed5.png",
    alt: "Calendar Day View",
  },
  {
    src: "/lovable-uploads/f6dde861-2a29-4190-ac37-23bfda379185.png",
    alt: "Calendar Week View",
  },
  {
    src: "/lovable-uploads/077c5504-2559-42f6-8354-7cc9ea93be8f.png",
    alt: "Calendar Month View",
  },
];

export const HeroSection = () => {
  return (
    <header className="container mx-auto px-4 py-8">
      <nav className="flex justify-between items-center mb-16">
        <h1 className="text-2xl font-bold text-primary">Taskify Minder</h1>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="outline">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button className="bg-primary hover:bg-primary/90">Sign Up Free</Button>
          </Link>
          <Link to="/contact">
            <Button variant="outline">Contact</Button>
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
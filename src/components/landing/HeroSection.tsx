import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu, X } from "lucide-react";
import { useState } from "react";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="container mx-auto px-4 py-8">
      <nav className="relative">
        {/* Desktop Navigation */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Taskify Minder</h1>
          
          {/* Mobile Menu Button */}
          <div className="flex items-center gap-4 md:hidden">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleMobileMenu}
              className="md:hidden"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
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
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-background border rounded-lg shadow-lg mt-2 p-4 space-y-3 md:hidden animate-fade-in">
            <Link to="/login" className="block">
              <Button variant="outline" className="w-full justify-start">
                Sign In
              </Button>
            </Link>
            <Link to="/signup" className="block">
              <Button className="w-full justify-start bg-primary hover:bg-primary/90">
                Sign Up Free
              </Button>
            </Link>
            <Link to="/contact" className="block">
              <Button variant="outline" className="w-full justify-start">
                Contact
              </Button>
            </Link>
          </div>
        )}
      </nav>

      <div className="grid md:grid-cols-2 gap-12 items-center mt-16">
        <div className="space-y-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            Your Professional Booking & Task Management Solution
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground">
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
          <ImageCarousel images={productImages} permanentArrows={true} />
        </div>
      </div>
    </header>
  );
};
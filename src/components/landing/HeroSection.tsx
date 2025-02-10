
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageCarousel } from "./ImageCarousel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Menu, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { ClientLogos } from "./ClientLogos";

const productImages = [
  {
    src: "/lovable-uploads/a00576d5-fb16-4a4b-a313-0e1cbb61b00c.png",
    alt: "Calendar Preview",
  },
  {
    src: "/lovable-uploads/7a8c5cac-2431-44db-8e9b-ca6e5ba6d633.png",
    alt: "Analytics Preview",
  },
  {
    src: "/lovable-uploads/292b8b91-64ee-4bf3-b4e6-1e68f77a6563.png",
    alt: "Tasks Preview",
  },
  {
    src: "/lovable-uploads/f35ff4e8-3ae5-4bc2-95f6-c3bef5d53689.png",
    alt: "CRM Preview",
  },
];

export const HeroSection = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-light via-background to-accent-light opacity-10" />
      
      <div className="container mx-auto px-4 py-8 relative">
        <nav className="relative">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="/lovable-uploads/e175e3cf-c66c-48c2-9a8c-3ee2a3b52232.png" 
                alt="smrtbookly" 
                className="h-16 md:h-20 w-auto" // Increased from h-12 to h-16/h-20
              />
            </Link>
            
            <div className="flex items-center gap-4 md:hidden">
              <ThemeToggle />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <ThemeToggle />
              <Link to="/login">
                <Button variant="outline" className="hover:scale-105 transition-transform">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105">
                  Sign Up Free
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="outline" className="hover:scale-105 transition-transform">
                  Contact
                </Button>
              </Link>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-background border rounded-lg shadow-lg mt-2 p-4 space-y-3 md:hidden animate-fade-in z-50">
              <Link to="/login" onClick={handleMenuClose}>
                <Button variant="outline" className="w-full justify-start">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup" onClick={handleMenuClose}>
                <Button className="w-full justify-start bg-gradient-to-r from-primary to-accent hover:opacity-90">
                  Sign Up Free
                </Button>
              </Link>
              <Link to="/contact" onClick={handleMenuClose}>
                <Button variant="outline" className="w-full justify-start">
                  Contact
                </Button>
              </Link>
            </div>
          )}
        </nav>

        <div className="grid md:grid-cols-2 gap-12 items-center mt-16">
          <div className="space-y-8 animate-fade-in">
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Your Professional Booking & Task Management Solution
            </h2>
            <p className="text-xl md:text-2xl text-muted-foreground">
              Streamline your workflow with our integrated booking calendar, task management, and analytics platform.
            </p>
            <div className="pt-4">
              <Link to="/signup">
                <Button 
                  size="lg" 
                  className="group relative bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all hover:scale-105"
                >
                  <span className="flex items-center gap-2">
                    Start Your Free Journey
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </span>
                </Button>
              </Link>
            </div>
          </div>
          <div className="animate-fade-in">
            <ImageCarousel images={productImages} permanentArrows={true} />
          </div>
        </div>
      </div>
      
      <ClientLogos />
    </header>
  );
};

import { Link } from "react-router-dom";

export const FooterSection = () => {
  return (
    <footer className="py-12 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © 2024 Taskify Minder. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign In
            </Link>
            <Link to="/signup" className="text-sm text-muted-foreground hover:text-foreground">
              Sign Up
            </Link>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
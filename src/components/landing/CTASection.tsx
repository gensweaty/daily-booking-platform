import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const CTASection = () => {
  return (
    <section className="py-20 bg-primary text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-6">Ready to Boost Your Productivity?</h2>
        <p className="text-lg mb-8 opacity-90">
          Join thousands of professionals already using Taskify Minder
        </p>
        <Link to="/signup">
          <Button size="lg" variant="secondary">
            Get Started for Free
          </Button>
        </Link>
      </div>
    </section>
  );
};
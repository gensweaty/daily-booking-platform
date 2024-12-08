import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, ChartBar, ListTodo, StickyNote, Users } from "lucide-react";

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-16">
          <h1 className="text-2xl font-bold text-primary">Taskify Minder Note</h1>
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
              Complete Agile Productivity Suite for Your Business
            </h2>
            <p className="text-lg text-muted-foreground">
              Manage tasks, take notes, schedule meetings, and track performance all in one place.
              Built for modern teams and individuals.
            </p>
            <Link to="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Get Started - It's Free
              </Button>
            </Link>
          </div>
          <div className="rounded-lg overflow-hidden shadow-xl">
            <img 
              src="/lovable-uploads/2fa9d0c5-8ae1-4a7f-9232-2fb4995649ef.png" 
              alt="Platform Preview" 
              className="w-full"
            />
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Everything You Need in One Place</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<ListTodo className="w-10 h-10 text-primary" />}
              title="Task Management"
              description="Create, organize, and track tasks with our intuitive Kanban board system."
            />
            <FeatureCard
              icon={<Calendar className="w-10 h-10 text-primary" />}
              title="Smart Calendar"
              description="Schedule meetings and manage your time with our flexible calendar view."
            />
            <FeatureCard
              icon={<StickyNote className="w-10 h-10 text-primary" />}
              title="Note Taking"
              description="Capture ideas and information with our rich text note-taking system."
            />
            <FeatureCard
              icon={<ChartBar className="w-10 h-10 text-primary" />}
              title="Analytics"
              description="Track productivity and monitor progress with detailed statistics."
            />
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-12">Trusted by Growing Teams</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard
              quote="Perfect for managing our team's daily tasks and meetings."
              author="Sarah Johnson"
              role="Project Manager"
            />
            <TestimonialCard
              quote="The calendar integration is a game-changer for our scheduling."
              author="Michael Chen"
              role="Team Lead"
            />
            <TestimonialCard
              quote="Finally, a tool that combines everything we need!"
              author="Emma Davis"
              role="Product Owner"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-lg mb-8 opacity-90">
            Join thousands of teams already using Taskify Minder Note
          </p>
          <Link to="/signup">
            <Button size="lg" variant="secondary">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2024 Taskify Minder Note. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Sign In
              </Link>
              <Link to="/signup" className="text-sm text-muted-foreground hover:text-foreground">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { 
  icon: React.ReactNode;
  title: string;
  description: string;
}) => (
  <div className="p-6 rounded-lg bg-background shadow-lg">
    <div className="mb-4">{icon}</div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

const TestimonialCard = ({ quote, author, role }: {
  quote: string;
  author: string;
  role: string;
}) => (
  <div className="p-6 rounded-lg bg-muted/30">
    <p className="text-lg mb-4">"{quote}"</p>
    <p className="font-semibold">{author}</p>
    <p className="text-sm text-muted-foreground">{role}</p>
  </div>
);

export default Landing;
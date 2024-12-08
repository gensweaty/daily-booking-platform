import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, ChartBar, ListTodo, StickyNote, CheckCircle } from "lucide-react";

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
              Your All-in-One Productivity Suite
            </h2>
            <p className="text-lg text-muted-foreground">
              Streamline your workflow with our integrated task management, calendar scheduling, note-taking, and analytics platform.
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

      {/* Features Section with Screenshots */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">Powerful Features for Modern Teams</h2>
          
          {/* Task Management */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div className="space-y-6">
              <div className="inline-block p-2 bg-primary/10 rounded-lg mb-4">
                <ListTodo className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Intuitive Task Management</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Kanban board view for visual task organization</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>File attachments and rich text descriptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Task status tracking and progress monitoring</span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg overflow-hidden shadow-xl">
              <img 
                src="/tasks-preview.png" 
                alt="Task Management Interface" 
                className="w-full border border-border rounded-lg shadow-lg"
              />
            </div>
          </div>

          {/* Calendar */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div className="order-2 md:order-1 rounded-lg overflow-hidden shadow-xl">
              <img 
                src="/calendar-preview.png" 
                alt="Calendar Interface" 
                className="w-full border border-border rounded-lg shadow-lg"
              />
            </div>
            <div className="order-1 md:order-2 space-y-6">
              <div className="inline-block p-2 bg-primary/10 rounded-lg mb-4">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Smart Calendar Management</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Multiple calendar views (month, week, day)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Event scheduling with customizable reminders</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Client booking management with payment tracking</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Notes */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div className="space-y-6">
              <div className="inline-block p-2 bg-primary/10 rounded-lg mb-4">
                <StickyNote className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Rich Note-Taking System</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Rich text editor with formatting options</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>File and image attachments support</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Color-coded organization system</span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg overflow-hidden shadow-xl">
              <img 
                src="/notes-preview.png" 
                alt="Notes Interface" 
                className="w-full border border-border rounded-lg shadow-lg"
              />
            </div>
          </div>

          {/* Analytics */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1 rounded-lg overflow-hidden shadow-xl">
              <img 
                src="/analytics-preview.png" 
                alt="Analytics Dashboard" 
                className="w-full border border-border rounded-lg shadow-lg"
              />
            </div>
            <div className="order-1 md:order-2 space-y-6">
              <div className="inline-block p-2 bg-primary/10 rounded-lg mb-4">
                <ChartBar className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Comprehensive Analytics</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Task completion and productivity metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Booking and revenue analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-1" />
                  <span>Custom date range filtering</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Boost Your Productivity?</h2>
          <p className="text-lg mb-8 opacity-90">
            Join thousands of professionals already using Taskify Minder Note
          </p>
          <Link to="/signup">
            <Button size="lg" variant="secondary">
              Get Started for Free
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

export default Landing;
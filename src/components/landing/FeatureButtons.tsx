
import { Button } from "@/components/ui/button";
import { Calendar, ListTodo, Users, BarChart } from "lucide-react";

export const FeatureButtons = () => {
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="py-12 bg-muted/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            What we offer
          </h2>
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Button 
              variant="outline"
              onClick={() => scrollToSection('smart-booking')}
              className="h-20 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-6"
            >
              <Calendar className="w-8 h-8 text-primary shrink-0" />
              <span className="text-base font-medium">Smart Appointment Scheduling</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => scrollToSection('task-management')}
              className="h-20 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-6"
            >
              <ListTodo className="w-8 h-8 text-accent shrink-0" />
              <span className="text-base font-medium">Kanban Board Task Management</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => scrollToSection('crm-solution')}
              className="h-20 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-6"
            >
              <Users className="w-8 h-8 text-primary shrink-0" />
              <span className="text-base font-medium">Modern CRM Solution</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => scrollToSection('analytics')}
              className="h-20 flex items-center justify-center gap-3 hover:bg-primary/10 hover:text-primary transition-all hover:scale-105 px-6"
            >
              <BarChart className="w-8 h-8 text-accent shrink-0" />
              <span className="text-base font-medium">Automated Performance Analytics</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

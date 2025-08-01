
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { ArrowRight, Sparkles } from "lucide-react";
import { memo } from "react";

export const HeroSection = memo(() => {
  const { language, t } = useLanguage();

  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 py-20 overflow-hidden gpu-layer">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background opacity-90" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-3xl animate-ultra-gentle-float" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-accent/10 to-secondary/10 rounded-full blur-3xl animate-ultra-gentle-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-full blur-2xl animate-ultra-gentle-float" style={{ animationDelay: '4s' }} />
      </div>

      {/* Decorative shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-primary/30 rounded-full animate-pulse" />
        <div className="absolute top-40 right-20 w-1 h-1 bg-accent/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-20 w-1.5 h-1.5 bg-secondary/30 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 right-10 w-1 h-1 bg-primary/40 rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
      </div>
      
      <div className="container mx-auto text-center relative z-10 space-y-8 animate-fade-in">
        <div className="space-y-6">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight">
            <span className="enhanced-gradient-text block">
              <LanguageText>
                {language === 'en' ? 'Organize Your Life' : language === 'es' ? 'Organiza Tu Vida' : 'მოაწყვე შენი ცხოვრება'}
              </LanguageText>
            </span>
            <span className="block mt-2">
              <LanguageText>
                {language === 'en' ? 'Effortlessly' : language === 'es' ? 'Sin Esfuerzo' : 'უდანაშაულოდ'}
              </LanguageText>
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            <LanguageText>
              {language === 'en' ? 'Transform your productivity with our all-in-one platform. Manage tasks, schedule events, track progress, and collaborate seamlessly.' : 
               language === 'es' ? 'Transforma tu productividad con nuestra plataforma todo en uno. Gestiona tareas, programa eventos, rastrea el progreso y colabora sin problemas.' : 
               'გარდაქმენი შენი პროდუქტივობა ჩვენი ყველაფერ-ერთ-ში პლატფორმით. მართე ამოცანები, დაგეგმე ღონისძიებები, თვალყუარი გაუტანე პროგრესს და თანამშრომლობდი უსწორფლოდ.'}
            </LanguageText>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            variant="purple"
            size="lg" 
            className="group transition-all duration-300 px-8 py-4 text-lg font-semibold"
          >
            <LanguageText>{language === 'en' ? 'Start Journey' : language === 'es' ? 'Comenzar Viaje' : 'დაიწყე მგზავრობა'}</LanguageText>
            <Sparkles className="ml-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
          </Button>
          
          <Button 
            variant="purple"
            size="lg"
            className="group transition-all duration-300 px-8 py-4 text-lg font-semibold"
          >
            <LanguageText>{language === 'en' ? 'Sign Up' : language === 'es' ? 'Registrarse' : 'რეგისტრაცია'}</LanguageText>
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
          <div className="glass-morphism p-6 rounded-xl hover:scale-105 transition-all duration-300 group">
            <div className="w-12 h-12 bg-gradient-to-r from-primary to-primary-light rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:rotate-6 transition-transform">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              <LanguageText>{language === 'en' ? 'Smart Organization' : language === 'es' ? 'Organización Inteligente' : 'ჭკვიანი ორგანიზაცია'}</LanguageText>
            </h3>
            <p className="text-muted-foreground text-sm">
              <LanguageText>
                {language === 'en' ? 'AI-powered task management that adapts to your workflow' : 
                 language === 'es' ? 'Gestión de tareas impulsada por IA que se adapta a tu flujo de trabajo' : 
                 'AI-ით მართული ამოცანების მენეჯმენტი, რომელიც ადაპტირდება შენს სამუშაო პროცესთან'}
              </LanguageText>
            </p>
          </div>

          <div className="glass-morphism p-6 rounded-xl hover:scale-105 transition-all duration-300 group">
            <div className="w-12 h-12 bg-gradient-to-r from-secondary to-secondary-light rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:rotate-6 transition-transform">
              <ArrowRight className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              <LanguageText>{language === 'en' ? 'Seamless Collaboration' : language === 'es' ? 'Colaboración Perfecta' : 'უწყვეტი თანამშრომლობა'}</LanguageText>
            </h3>
            <p className="text-muted-foreground text-sm">
              <LanguageText>
                {language === 'en' ? 'Work together in real-time with your team members' : 
                 language === 'es' ? 'Trabaja en tiempo real con los miembros de tu equipo' : 
                 'იმუშავე რეალურ დროში შენი გუნდის წევრებთან ერთად'}
              </LanguageText>
            </p>
          </div>

          <div className="glass-morphism p-6 rounded-xl hover:scale-105 transition-all duration-300 group">
            <div className="w-12 h-12 bg-gradient-to-r from-accent to-accent-light rounded-lg flex items-center justify-center mb-4 mx-auto group-hover:rotate-6 transition-transform">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              <LanguageText>{language === 'en' ? 'Progress Tracking' : language === 'es' ? 'Seguimiento del Progreso' : 'პროგრესის თვალყურისდევნება'}</LanguageText>
            </h3>
            <p className="text-muted-foreground text-sm">
              <LanguageText>
                {language === 'en' ? 'Visualize your achievements and stay motivated' : 
                 language === 'es' ? 'Visualiza tus logros y mantente motivado' : 
                 'ვიზუალიზაცია გაუკეთე შენს მიღწევებს და დარჩი მოტივირებული'}
              </LanguageText>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
});

HeroSection.displayName = "HeroSection";

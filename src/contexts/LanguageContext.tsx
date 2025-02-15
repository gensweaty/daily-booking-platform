
import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'es';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations = {
  en: {
    // Navigation
    "nav.signin": "Sign In",
    "nav.signup": "Sign Up",
    "nav.contact": "Contact",
    "nav.startJourney": "Start Your Free Journey",
    
    // Hero Section
    "hero.title": "Boost Your Business Productivity with SmartBookly",
    "hero.subtitle": "All-in-One SaaS - Event Booking, Task Management, CRM, and Analytics Solution.",
    "hero.description": "Take full control of your workflow with our seamless booking calendar, powerful task management, intelligent customer relationship management, and integrated analytics. Everything your business needs, all in one place.",
    
    // Features
    "features.title": "What we offer",
    "features.booking": "Smart Appointment Scheduling",
    "features.tasks": "Kanban Board Task Management",
    "features.crm": "Modern CRM Solution",
    "features.analytics": "Automated Performance Analytics",
    
    // CTA Section
    "cta.title": "Ready to Boost Your Business Productivity?",
    "cta.subtitle": "Join the Many Professionals Already Using SmartBookly",
    "cta.button": "Get Started for Free",
    
    // Footer
    "footer.description": "Streamline Your Workflow with Our Integrated Booking Calendar, Task Management, CRM, and Analytics Platform.",
    "footer.navigation": "Navigation",
    "footer.legal": "Legal",
    "footer.rights": "© 2025 Smrtbookly.Com All rights reserved.",
    
    // Business Types
    "business.events": "Events & Entertainment",
    "business.health": "Health & Medicine",
    "business.sports": "Sports & Fitness",
    "business.beauty": "Beauty & Wellness",
    "business.personal": "Personal Meetings & Services",
    "business.education": "Education",
  },
  es: {
    // Navigation
    "nav.signin": "Iniciar Sesión",
    "nav.signup": "Registrarse",
    "nav.contact": "Contacto",
    "nav.startJourney": "Comienza Gratis",
    
    // Hero Section
    "hero.title": "Impulsa la Productividad de tu Negocio con SmartBookly",
    "hero.subtitle": "Solución Todo en Uno - Reservas, Gestión de Tareas, CRM y Análisis.",
    "hero.description": "Toma el control total de tu flujo de trabajo con nuestro calendario de reservas, gestión de tareas, administración de relaciones con clientes y análisis integrado. Todo lo que tu negocio necesita, en un solo lugar.",
    
    // Features
    "features.title": "Lo que ofrecemos",
    "features.booking": "Programación Inteligente de Citas",
    "features.tasks": "Gestión de Tareas con Tablero Kanban",
    "features.crm": "Solución CRM Moderna",
    "features.analytics": "Análisis de Rendimiento Automatizado",
    
    // CTA Section
    "features.mainTitle": "Características Poderosas para Profesionales Modernos",
    "cta.title": "¿Listo para Impulsar la Productividad de tu Negocio?",
    "cta.subtitle": "Únete a los Profesionales que ya Usan SmartBookly",
    "cta.button": "Comienza Gratis",
    
    // Footer
    "footer.description": "Optimiza tu Flujo de Trabajo con Nuestra Plataforma Integrada de Calendario de Reservas, Gestión de Tareas, CRM y Análisis.",
    "footer.navigation": "Navegación",
    "footer.legal": "Legal",
    "footer.rights": "© 2025 Smrtbookly.Com Todos los derechos reservados.",
    
    // Business Types
    "business.events": "Eventos y Entretenimiento",
    "business.health": "Salud y Medicina",
    "business.sports": "Deportes y Fitness",
    "business.beauty": "Belleza y Bienestar",
    "business.personal": "Reuniones y Servicios Personales",
    "business.education": "Educación",
  }
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

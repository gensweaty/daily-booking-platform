
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
    "features.mainTitle": "Powerful Features for Modern Professionals",
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
    
    // Contact Page
    "contact.title": "Get in Touch",
    "contact.subtitle": "We'd love to hear from you",
    "contact.name": "Full Name",
    "contact.email": "Email Address",
    "contact.message": "Your Message",
    "contact.submit": "Send Message",
    "contact.success": "Message sent successfully!",
    
    // Legal Page
    "legal.title": "Legal Information",
    "legal.terms": "Terms of Service",
    "legal.privacy": "Privacy Policy",
    "legal.cookies": "Cookie Policy",
    
    // Dashboard
    "dashboard.welcome": "Welcome to SmartBookly!",
    "dashboard.subtitle": "Your all-in-one hub for tasks, bookings, CRM, and insights—stay organized effortlessly.",
    "dashboard.tasks": "Tasks",
    "dashboard.events": "Events",
    "dashboard.customers": "Customers",
    "dashboard.analytics": "Analytics",
    "dashboard.signOut": "Sign Out",
    "dashboard.profile": "User Profile",
    "dashboard.changePassword": "Change Password",
    
    // Auth
    "auth.emailLabel": "Email",
    "auth.passwordLabel": "Password",
    "auth.confirmPasswordLabel": "Confirm Password",
    "auth.usernameLabel": "Username",
    "auth.forgotPassword": "Forgot password?",
    "auth.signInButton": "Sign In",
    "auth.signUpButton": "Sign Up",
    "auth.backToSignIn": "Back to Sign In",
    "auth.resetPassword": "Reset Password",
    "auth.sendResetLink": "Send Reset Link",
    
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
    "features.mainTitle": "Características Poderosas para Profesionales Modernos",
    "features.booking": "Programación Inteligente de Citas",
    "features.tasks": "Gestión de Tareas con Tablero Kanban",
    "features.crm": "Solución CRM Moderna",
    "features.analytics": "Análisis de Rendimiento Automatizado",
    
    // CTA Section
    "cta.title": "¿Listo para Impulsar la Productividad de tu Negocio?",
    "cta.subtitle": "Únete a los Profesionales que ya Usan SmartBookly",
    "cta.button": "Comienza Gratis",
    
    // Footer
    "footer.description": "Optimiza tu Flujo de Trabajo con Nuestra Plataforma Integrada de Calendario de Reservas, Gestión de Tareas, CRM y Análisis.",
    "footer.navigation": "Navegación",
    "footer.legal": "Legal",
    "footer.rights": "© 2025 Smrtbookly.Com Todos los derechos reservados.",
    
    // Contact Page
    "contact.title": "Contáctanos",
    "contact.subtitle": "Nos encantaría saber de ti",
    "contact.name": "Nombre Completo",
    "contact.email": "Correo Electrónico",
    "contact.message": "Tu Mensaje",
    "contact.submit": "Enviar Mensaje",
    "contact.success": "¡Mensaje enviado con éxito!",
    
    // Legal Page
    "legal.title": "Información Legal",
    "legal.terms": "Términos de Servicio",
    "legal.privacy": "Política de Privacidad",
    "legal.cookies": "Política de Cookies",
    
    // Dashboard
    "dashboard.welcome": "¡Bienvenido a SmartBookly!",
    "dashboard.subtitle": "Tu centro integral para tareas, reservas, CRM y análisis: mantente organizado sin esfuerzo.",
    "dashboard.tasks": "Tareas",
    "dashboard.events": "Eventos",
    "dashboard.customers": "Clientes",
    "dashboard.analytics": "Análisis",
    "dashboard.signOut": "Cerrar Sesión",
    "dashboard.profile": "Perfil de Usuario",
    "dashboard.changePassword": "Cambiar Contraseña",
    
    // Auth
    "auth.emailLabel": "Correo Electrónico",
    "auth.passwordLabel": "Contraseña",
    "auth.confirmPasswordLabel": "Confirmar Contraseña",
    "auth.usernameLabel": "Nombre de Usuario",
    "auth.forgotPassword": "¿Olvidaste tu contraseña?",
    "auth.signInButton": "Iniciar Sesión",
    "auth.signUpButton": "Registrarse",
    "auth.backToSignIn": "Volver a Iniciar Sesión",
    "auth.resetPassword": "Restablecer Contraseña",
    "auth.sendResetLink": "Enviar Link de Restablecimiento",
    
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

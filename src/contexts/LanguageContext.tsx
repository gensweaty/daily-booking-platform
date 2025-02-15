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
    "features.businessTitle": "For Small and Medium Business Like",
    
    // Smart Booking Calendar
    "booking.title": "Smart Booking Calendar",
    "booking.description": "Efficiently manage your appointments and events",
    "booking.feature1": "Multiple calendar views (month, week, day)",
    "booking.feature2": "Event scheduling with customizable time slots",
    "booking.feature3": "Client booking management with payment tracking",
    "booking.feature4": "Automated Event Synchronization with CRM",

    // Analytics
    "analytics.title": "Comprehensive Analytics",
    "analytics.description": "Track your performance and growth",
    "analytics.feature1": "Booking and revenue analytics",
    "analytics.feature2": "Custom date range filtering",
    "analytics.feature3": "Income comparison across months",
    "analytics.feature4": "Interactive visual metrics & graphs",
    "analytics.feature5": "One-click Excel download",

    // CRM
    "crm.title": "Customer Relationship Management",
    "crm.description": "Build and maintain strong client relationships",
    "crm.feature1": "Centralized customer information management",
    "crm.feature2": "File attachments and document organization",
    "crm.feature3": "Payment tracking and status monitoring",
    "crm.feature4": "Elastic search for quick data access",
    "crm.feature5": "One-click Excel download of all displayed data",

    // Task Management
    "tasks.title": "Task Management",
    "tasks.description": "Stay organized and productive",
    "tasks.feature1": "Kanban board for visual task organization",
    "tasks.feature2": "Task status tracking and progress monitoring",
    "tasks.feature3": "Efficient task prioritization",
    "tasks.feature4": "Simple drag-and-drop functionality",
    "tasks.feature5": "Quick note-saving for tasks",
    
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
    "business.eventsDesc": "Perfect for event planners and entertainment venues",
    "business.health": "Health & Medicine",
    "business.healthDesc": "Ideal for medical practices and healthcare providers",
    "business.sports": "Sports & Fitness",
    "business.sportsDesc": "Great for gyms and fitness instructors",
    "business.beauty": "Beauty & Wellness",
    "business.beautyDesc": "Designed for spas and wellness centers",
    "business.personal": "Personal Meetings & Services",
    "business.personalDesc": "Perfect for consultants and service providers",
    "business.education": "Education",
    "business.educationDesc": "Tailored for educational institutions and tutors"
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
    "features.businessTitle": "Para Pequeñas y Medianas Empresas Como",
    
    // Smart Booking Calendar
    "booking.title": "Calendario de Reservas Inteligente",
    "booking.description": "Gestiona eficientemente tus citas y eventos",
    "booking.feature1": "Múltiples vistas de calendario (mes, semana, día)",
    "booking.feature2": "Programación de eventos con horarios personalizables",
    "booking.feature3": "Gestión de reservas de clientes con seguimiento de pagos",
    "booking.feature4": "Sincronización automática de eventos con CRM",

    // Analytics
    "analytics.title": "Análisis Completo",
    "analytics.description": "Monitorea tu rendimiento y crecimiento",
    "analytics.feature1": "Análisis de reservas e ingresos",
    "analytics.feature2": "Filtrado personalizado por rango de fechas",
    "analytics.feature3": "Comparación de ingresos entre meses",
    "analytics.feature4": "Métricas y gráficos visuales interactivos",
    "analytics.feature5": "Descarga en Excel con un clic",

    // CRM
    "crm.title": "Gestión de Relaciones con Clientes",
    "crm.description": "Construye y mantén relaciones sólidas con los clientes",
    "crm.feature1": "Gestión centralizada de información de clientes",
    "crm.feature2": "Archivos adjuntos y organización de documentos",
    "crm.feature3": "Seguimiento de pagos y monitoreo de estado",
    "crm.feature4": "Búsqueda elástica para acceso rápido a datos",
    "crm.feature5": "Descarga en Excel de todos los datos mostrados con un clic",

    // Task Management
    "tasks.title": "Gestión de Tareas",
    "tasks.description": "Mantente organizado y productivo",
    "tasks.feature1": "Tablero Kanban para organización visual de tareas",
    "tasks.feature2": "Seguimiento de estado y monitoreo de progreso",
    "tasks.feature3": "Priorización eficiente de tareas",
    "tasks.feature4": "Funcionalidad simple de arrastrar y soltar",
    "tasks.feature5": "Guardado rápido de notas para tareas",
    
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
    "business.eventsDesc": "Perfecto para event planners y locales de entretenimiento",
    "business.health": "Salud y Medicina",
    "business.healthDesc": "Ideal para consultorios médicos y proveedores de atención sanitaria",
    "business.sports": "Deportes y Fitness",
    "business.sportsDesc": "Great for gyms and fitness instructors",
    "business.beauty": "Belleza y Bienestar",
    "business.beautyDesc": "Diseñado para spas y centros de bienestar",
    "business.personal": "Reuniones personales y servicios",
    "business.personalDesc": "Perfecto para consultores y proveedores de servicios",
    "business.education": "Educación",
    "business.educationDesc": "Adaptado para instituciones educativas y tutores"
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

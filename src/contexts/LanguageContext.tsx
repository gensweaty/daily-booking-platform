
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
    "crm.customers": "Customers",
    "crm.addCustomer": "Add Customer",
    "crm.fullName": "Full Name",
    "crm.phoneNumber": "Phone Number",
    "crm.socialLinkEmail": "Social Link/Email",
    "crm.paymentStatus": "Payment Status",
    "crm.dates": "Dates",
    "crm.comment": "Comment",
    "crm.attachments": "Attachments",
    "crm.newCustomer": "New Customer",
    "crm.createEventForCustomer": "Create event for this customer",
    "crm.selectPaymentStatus": "Select payment status",
    "crm.addComment": "Add a comment about the customer",
    "crm.create": "Create",
    "crm.cancel": "Cancel",
    "crm.open": "Open",
    "crm.search": "Search...",

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
    
    // Auth
    "auth.welcome": "Welcome to SmartBookly",
    "auth.description": "Complete Agile productivity - tasks notes calendar all in one",
    "auth.emailLabel": "Email",
    "auth.passwordLabel": "Password",
    "auth.passwordRequirements": "Password (min. 6 characters, include numbers)",
    "auth.confirmPasswordLabel": "Confirm Password",
    "auth.usernameLabel": "Username",
    "auth.forgotPassword": "Forgot password?",
    "auth.signInButton": "Sign In",
    "auth.signUpButton": "Sign Up",
    "auth.backToSignIn": "Back to Sign In",
    "auth.resetPassword": "Reset Password",
    "auth.sendResetLink": "Send Reset Link",
    "auth.sending": "Sending...",
    "auth.enterEmail": "Enter your email",
    "auth.resetLinkSent": "Reset Link Sent",
    "auth.resetLinkSentDescription": "If an account exists with this email, you will receive a password reset link.",
    "auth.passwordsDoNotMatch": "Passwords do not match",
    "auth.passwordTooShort": "Password must be at least 6 characters long",
    "auth.signingUp": "Signing up...",
    "auth.loading": "Loading...",
    
    // Dashboard
    "dashboard.welcome": "Welcome to SmartBookly!",
    "dashboard.subtitle": "Your all-in-one hub for tasks, bookings, CRM, and insights—stay organized effortlessly.",
    "dashboard.bookingCalendar": "Booking Calendar",
    "dashboard.statistics": "Statistics",
    "dashboard.tasks": "Tasks",
    "dashboard.crm": "CRM",
    "dashboard.month": "Month",
    "dashboard.week": "Week",
    "dashboard.day": "Day",
    "dashboard.addEvent": "Add Event",
    "dashboard.editEvent": "Edit Event",
    "dashboard.totalTasks": "Total Tasks",
    "dashboard.inProgress": "In Progress",
    "dashboard.totalEvents": "Total Events",
    "dashboard.totalIncome": "Total Income",
    "dashboard.fromAllEvents": "From all events",
    "dashboard.completed": "completed",
    "dashboard.todo": "todo",
    "dashboard.partlyPaid": "partly paid",
    "dashboard.fullyPaid": "fully paid",
    "dashboard.totalBookingsGrowth": "Total Bookings Growth",
    "dashboard.threeMonthIncome": "Three Month Income Comparison",
    "dashboard.bookingDates": "Booking Dates",
    "dashboard.months": "Months",
    "dashboard.income": "Income",
    "dashboard.signOut": "Sign Out",
    "dashboard.profile": "User Profile",
    "dashboard.changePassword": "Change Password",

    // Events
    "events.addNewEvent": "Add New Event",
    "events.fullNameRequired": "Full Name (required)",
    "events.phoneNumber": "Phone Number",
    "events.socialLinkEmail": "Social Link or Email",
    "events.paymentStatus": "Payment Status",
    "events.selectPaymentStatus": "Select payment status",
    "events.eventNotes": "Event Notes",
    "events.addEventNotes": "Add notes about the event",
    "events.attachment": "Attachment (optional)",
    "events.chooseFile": "Choose File",
    "events.noFileChosen": "No file chosen",
    "events.createEvent": "Create Event",
    "events.maxSize": "Max size: Images - 2MB, Documents - 1MB",
    "events.supportedFormats": "Supported formats: Images (jpg, jpeg, png, webp), Documents (pdf, docx, xlsx, pptx)"
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
    "crm.customers": "Clientes",
    "crm.addCustomer": "Agregar Cliente",
    "crm.fullName": "Nombre Completo",
    "crm.phoneNumber": "Número de Teléfono",
    "crm.socialLinkEmail": "Link Social/Email",
    "crm.paymentStatus": "Estado de Pago",
    "crm.dates": "Fechas",
    "crm.comment": "Comentario",
    "crm.attachments": "Adjuntos",
    "crm.newCustomer": "Nuevo Cliente",
    "crm.createEventForCustomer": "Crear evento para este cliente",
    "crm.selectPaymentStatus": "Seleccionar estado de pago",
    "crm.addComment": "Agregar un comentario sobre el cliente",
    "crm.create": "Crear",
    "crm.cancel": "Cancelar",
    "crm.open": "Abrir",
    "crm.search": "Buscar...",

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
    
    // Auth
    "auth.welcome": "Bienvenido a SmartBookly",
    "auth.description": "Productividad Ágil completa - tareas, notas, calendario todo en uno",
    "auth.emailLabel": "Correo Electrónico",
    "auth.passwordLabel": "Contraseña",
    "auth.passwordRequirements": "Contraseña (mín. 6 caracteres, incluir números)",
    "auth.confirmPasswordLabel": "Confirmar Contraseña",
    "auth.usernameLabel": "Nombre de Usuario",
    "auth.forgotPassword": "¿Olvidaste tu contraseña?",
    "auth.signInButton": "Iniciar Sesión",
    "auth.signUpButton": "Registrarse",
    "auth.backToSignIn": "Volver a Iniciar Sesión",
    "auth.resetPassword": "Restablecer Contraseña",
    "auth.sendResetLink": "Enviar Link de Restablecimiento",
    "auth.sending": "Enviando...",
    "auth.enterEmail": "Ingresa tu correo electrónico",
    "auth.resetLinkSent": "Link de Restablecimiento Enviado",
    "auth.resetLinkSentDescription": "Si existe una cuenta con este correo electrónico, recibirás un link para restablecer tu contraseña.",
    "auth.passwordsDoNotMatch": "Las contraseñas no coinciden",
    "auth.passwordTooShort": "La contraseña debe tener al menos 6 caracteres",
    "auth.signingUp": "Registrando...",
    "auth.loading": "Cargando...",
    
    // Dashboard
    "dashboard.welcome": "¡Bienvenido a SmartBookly!",
    "dashboard.subtitle": "Tu centro integral para tareas, reservas, CRM y análisis: mantente organizado sin esfuerzo.",
    "dashboard.bookingCalendar": "Calendario de Reservas",
    "dashboard.statistics": "Estadísticas",
    "dashboard.tasks": "Tareas",
    "dashboard.crm": "CRM",
    "dashboard.month": "Mes",
    "dashboard.week": "Semana",
    "dashboard.day": "Día",
    "dashboard.addEvent": "Agregar Evento",
    "dashboard.editEvent": "Editar Evento",
    "dashboard.totalTasks": "Total de Tareas",
    "dashboard.inProgress": "En Progreso",
    "dashboard.totalEvents": "Total de Eventos",
    "dashboard.totalIncome": "Ingresos Totales",
    "dashboard.fromAllEvents": "De todos los eventos",
    "dashboard.completed": "completadas",
    "dashboard.todo": "pendientes",
    "dashboard.partlyPaid": "pago parcial",
    "dashboard.fullyPaid": "pago completo",
    "dashboard.totalBookingsGrowth": "Crecimiento Total de Reservas",
    "dashboard.threeMonthIncome": "Comparación de Ingresos Trimestral",
    "dashboard.bookingDates": "Fechas de Reserva",
    "dashboard.months": "Meses",
    "dashboard.income": "Ingresos",
    "dashboard.signOut": "Cerrar Sesión",
    "dashboard.profile": "Perfil de Usuario",
    "dashboard.changePassword": "Cambiar Contraseña",

    // Events
    "events.addNewEvent": "Agregar Nuevo Evento",
    "events.fullNameRequired": "Nombre Completo (requerido)",
    "events.phoneNumber": "Número de Teléfono",
    "events.socialLinkEmail": "Link Social o Email",
    "events.paymentStatus": "Estado de Pago",
    "events.selectPaymentStatus": "Seleccionar estado de pago",
    "events.eventNotes": "Notas del Evento",
    "events.addEventNotes": "Agregar notas sobre el evento",
    "events.attachment": "Archivo Adjunto (opcional)",
    "events.chooseFile": "Elegir Archivo",
    "events.noFileChosen": "Ningún archivo seleccionado",
    "events.createEvent": "Crear Evento",
    "events.maxSize": "Tamaño máximo: Imágenes - 2MB, Documentos - 1MB",
    "events.supportedFormats": "Formatos soportados: Imágenes (jpg, jpeg, png, webp), Documentos (pdf, docx, xlsx, pptx)"
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

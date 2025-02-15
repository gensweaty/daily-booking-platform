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
    "business.educationDesc": "Tailored for educational institutions and tutors",

    // Legal Page
    "legal.termsAndPrivacy": "Terms of Service & Privacy Policy",
    "legal.lastUpdated": "Last Updated",
    "legal.termsTitle": "Terms of Service",
    "legal.termsIntro": "Welcome to SmartBookly. These Terms of Service (\"Terms\") govern your use of our SaaS platform and services (\"Services\"). By accessing or using our Services, you agree to these Terms. If you do not agree, please do not use our Services.",
    "legal.generalInfo": "General Information",
    "legal.companyName": "Company Name",
    "legal.companyRegistered": "Registered in",
    "legal.contactEmail": "Contact Email",
    "legal.eligibility": "Eligibility",
    "legal.eligibilityText": "You must be at least 18 years old to use our Services. By using our platform, you confirm that you meet this requirement.",
    "legal.accountTitle": "Account Registration & Security",
    "legal.accountInfo": "You must provide accurate and complete information when creating an account.",
    "legal.accountSecurity": "You are responsible for maintaining the confidentiality of your account and password.",
    "legal.accountNotify": "Notify us immediately of any unauthorized access to your account.",
    "legal.acceptableUseTitle": "Acceptable Use",
    "legal.acceptableUse1": "You agree not to misuse our Services or violate any applicable laws.",
    "legal.acceptableUse2": "You must not engage in fraud, distribute malware, or infringe on intellectual property rights.",
    "legal.acceptableUse3": "We reserve the right to suspend or terminate accounts violating these rules.",
    "legal.paymentsTitle": "Payments & Subscriptions",
    "legal.payments1": "Services may require a paid subscription, billed on a recurring basis.",
    "legal.payments2": "Prices are subject to change, and we will notify you in advance.",
    "legal.payments3": "Refunds are issued only in specific cases as outlined in our Refund Policy.",
    "legal.privacyTitle": "Privacy Policy",
    "legal.privacyIntro": "We respect your privacy and are committed to protecting your personal data.",
    "legal.infoCollectTitle": "Information We Collect",
    "legal.infoCollectIntro": "We collect",
    "legal.infoCollect1": "Personal data (e.g., name, email, payment details) when you register.",
    "legal.infoCollect2": "Usage data (e.g., IP address, device information, browsing behavior).",
    "legal.infoCollect3": "Cookies and tracking technologies to improve our Services.",
    "legal.dataUseTitle": "How We Use Your Data",
    "legal.dataUseIntro": "We use your data for",
    "legal.dataUse1": "Providing and improving our Services.",
    "legal.dataUse2": "Processing payments and subscriptions.",
    "legal.dataUse3": "Communication and support.",
    "legal.dataUse4": "Compliance with legal obligations.",
    "legal.dataRightsTitle": "Data Protection Rights",
    "legal.dataRightsIntro": "You have the right to",
    "legal.dataRights1": "Access, correct, or delete your data.",
    "legal.dataRights2": "Withdraw consent at any time.",
    "legal.dataRights3": "Object to data processing in certain circumstances.",
    "legal.dataRights4": "File a complaint with a data protection authority.",
    "legal.contactUs": "Contact Us",
    "legal.contactUsText": "If you have any questions about our Terms or Privacy Policy, please contact us at info@smartbookly.com",
    
    // Dashboard
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

    // CRM
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
    "events.supportedFormats": "Supported formats: Images (jpg, jpeg, png, webp), Documents (pdf, docx, xlsx, pptx)",
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
    "business.educationDesc": "Adaptado para instituciones educativas y tutores",

    // Legal Page
    "legal.termsAndPrivacy": "Términos de Servicio y Política de Privacidad",
    "legal.lastUpdated": "Última actualización",
    "legal.termsTitle": "Términos de Servicio",
    "legal.termsIntro": "Bienvenido a SmartBookly. Estos Términos de Servicio (\"Términos\") rigen el uso de nuestra plataforma SaaS y servicios (\"Servicios\"). Al acceder o utilizar nuestros Servicios, usted acepta estos Términos. Si no está de acuerdo, le solicitamos que no utilice nuestros Servicios.",
    "legal.generalInfo": "Información General",
    "legal.companyName": "Nombre de la empresa",
    "legal.companyRegistered": "Registrada en",
    "legal.contactEmail": "Correo de contacto",
    "legal.eligibility": "Elegibilidad",
    "legal.eligibilityText": "Debe tener al menos 18 años para utilizar nuestros Servicios. Al utilizar nuestra plataforma, usted confirma que cumple con este requisito.",
    "legal.accountTitle": "Registro de Cuenta y Seguridad",
    "legal.accountInfo": "Debe proporcionar información precisa y completa al crear una cuenta.",
    "legal.accountSecurity": "Es responsable de mantener la confidencialidad de su cuenta y contraseña.",
    "legal.accountNotify": "Debe notificarnos de inmediato en caso de acceso no autorizado a su cuenta.",
    "legal.acceptableUseTitle": "Uso Aceptable",
    "legal.acceptableUse1": "Usted se compromete a no utilizar nuestros Servicios de manera indebida ni a infringir leyes aplicables.",
    "legal.acceptableUse2": "No debe participar en fraudes, distribuir malware ni infringir derechos de propiedad intelectual.",
    "legal.acceptableUse3": "Nos reservamos el derecho de suspender o cancelar cuentas que violen estas normas.",
    "legal.paymentsTitle": "Pagos y Suscripciones",
    "legal.payments1": "Algunos Servicios pueden requerir una suscripción de pago, facturada de manera recurrente.",
    "legal.payments2": "Los precios están sujetos a cambios y le notificaremos con antelación.",
    "legal.payments3": "Los reembolsos solo se emitirán en los casos específicos descritos en nuestra Política de Reembolsos.",
    "legal.privacyTitle": "Política de Privacidad",
    "legal.privacyIntro": "Respetamos su privacidad y estamos comprometidos con la protección de sus datos personales.",
    "legal.infoCollectTitle": "Información que Recopilamos",
    "legal.infoCollectIntro": "Recopilamos",
    "legal.infoCollect1": "Datos personales (nombre, correo electrónico, detalles de pago) cuando se registra.",
    "legal.infoCollect2": "Datos de uso (dirección IP, información del dispositivo, comportamiento de navegación).",
    "legal.infoCollect3": "Cookies y tecnologías de seguimiento para mejorar nuestros Servicios.",
    "legal.dataUseTitle": "Cómo Usamos sus Datos",
    "legal.dataUseIntro": "Utilizamos su información para",
    "legal.dataUse1": "Proporcionar y mejorar nuestros Servicios.",
    "legal.dataUse2": "Procesar pagos y gestionar suscripciones.",
    "legal.dataUse3": "Comunicación y soporte.",
    "legal.dataUse4": "Cumplir con obligaciones legales.",
    "legal.dataRightsTitle": "Derechos de Protección de Datos",
    "legal.dataRightsIntro": "Usted tiene derecho a",
    "legal.dataRights1": "Acceder, corregir o eliminar sus datos.",
    "legal.dataRights2": "Retirar su consentimiento en cualquier momento.",
    "legal.dataRights3": "Oponerse al procesamiento de sus datos en determinadas circunstancias.",
    "legal.dataRights4": "Presentar una queja ante una autoridad de protección de datos.",
    "legal.contactUs": "Contacto",
    "legal.contactUsText": "Si tiene preguntas sobre nuestros Términos o Política de Privacidad, contáctenos en info@smartbookly.com",
    
    // Dashboard
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

    // CRM
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
    "events.supportedFormats": "Formatos soportados: Imágenes (jpg, jpeg, png, webp), Documentos (pdf, docx, xlsx, pptx)",
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

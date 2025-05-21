import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
const Legal = () => {
  const {
    theme
  } = useTheme();
  const {
    t,
    language
  } = useLanguage();
  return <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="hover:bg-accent">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <img src={theme === 'dark' ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png" : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"} alt="SmartBookly Logo" className="h-8 md:h-10 w-auto" />
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-lg shadow-sm p-8 mb-8">
            <LanguageText>
              {language === 'ka' && <>
                  <h1 className="text-3xl font-bold mb-4">პირობები და კონფიდენციალურობის პოლიტიკა</h1>
                  <p className="text-muted-foreground mb-8">ბოლო განახლება: 03.03.2025</p>
                  
                  <section className="mb-10">
                    <h2 className="text-2xl font-semibold mb-4">მომსახურების პირობები</h2>
                    <p className="mb-6">კეთილი იყოს თქვენი მობრძანება Smartbookly.com-ზე. ეს მომსახურების პირობები ("პირობები") არეგულირებს თქვენ მიერ ჩვენი SaaS პლატფორმისა და სერვისების ("სერვისები") გამოყენებას. ჩვენს სერვისებზე წვდომით ან გამოყენებით თქვენ ეთანხმებით ამ პირობებს. თუ არ ეთანხმებით, გთხოვთ, არ გამოიყენოთ ჩვენი სერვისები.</p>
                  
                  <div className="space-y-6">
                    <div className="p-4 rounded-md bg-muted">
                      <h3 className="text-xl font-semibold mb-2">1. ზოგადი ინფორმაცია</h3>
                      <p className="mb-1">კომპანიის სახელი: AI SOFTWARE FACTORY LTD</p>
                      <p className="mb-1">რეგისტრირებულია: <a href="https://mrueqpffzauvdxmuwhfa.supabase.co/storage/v1/object/sign/event_attachments/db1c8d7c-a9d4-4cbb-9124-071123d66930/9cae890f-15d2-4f4e-aa01-b32477019b6d.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InN0b3JhZ2UtdXJsLXNpZ25pbmcta2V5X2UxYWUwMTczLTA1ZDctNDQ3Zi05NzE5LWU2ZDg1MDE1MzNlNiJ9.eyJ1cmwiOiJldmVudF9hdHRhY2htZW50cy9kYjFjOGQ3Yy1hOWQ0LTRjYmItOTEyNC0wNzExMjNkNjY5MzAvOWNhZTg5MGYtMTVkMi00ZjRlLWFhMDEtYjMyNDc3MDE5YjZkLnBkZiIsImlhdCI6MTc0Nzg1MzExMiwiZXhwIjoxNzQ3ODU2NzEyfQ.2rewdJEA6E0TPRE131HOG8ynA5QqXpPKL6IeZpj3LiI" target="_blank" rel="noopener noreferrer">UK Companies House</a></p>
                      <p>საკონტაქტო ელ. ფოსტა: info@smartbookly.com</p>
                    </div>
                    
                    <div className="p-4 rounded-md bg-muted">
                      <h3 className="text-xl font-semibold mb-2">2. უფლებამოსილება</h3>
                      <p>თქვენ უნდა იყოთ მინიმუმ 18 წლის, რომ გამოიყენოთ ჩვენი სერვისები. ჩვენი პლატფორმის გამოყენებით, თქვენ ადასტურებთ, რომ აკმაყოფილებთ ამ მოთხოვნას.</p>
                    </div>
                    
                    <div className="p-4 rounded-md bg-muted">
                      <h3 className="text-xl font-semibold mb-2">3. ანგარიშის რეგისტრაცია და უსაფრთხოება</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>ანგარიშის შექმნისას უნდა მიუთითოთ ზუსტი და სრული ინფორმაცია.</li>
                        <li>თქვენ ხართ პასუხისმგებელი თქვენი ანგარიშისა და პაროლის კონფიდენციალურობის შენარჩუნებაზე.</li>
                        <li>დაუყოვნებლივ შეგვატყობინეთ თქვენს ანგარიშზე არაავტორიზებული წვდომის შესახებ.</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 rounded-md bg-muted">
                      <h3 className="text-xl font-semibold mb-2">4. მისაღები გამოყენება</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>თქვენ თანახმა ხართ, რომ არ გამოიყენოთ ჩვენი სერვისები ბოროტად ან არ დაარღვიოთ მოქმედი კანონები.</li>
                        <li>თქვენ არ უნდა ჩაერთოთ თაღლითობაში, გაავრცელოთ მავნე პროგრამები ან დაარღვიოთ ინტელექტუალური საკუთრების უფლებები.</li>
                        <li>ჩვენ ვიტოვებთ უფლებას შევაჩეროთ ან შევაჩეროთ ანგარიშები, რომლებიც არღვევს ამ წესებს.</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 rounded-md bg-muted">
                      <h3 className="text-xl font-semibold mb-2">5. გადახდები და გამოწერები</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>სერვისებმა შეიძლება მოითხოვოს ფასიანი გამოწერა, ანგარიშსწორება განმეორებით საფუძველზე.</li>
                        <li>ფასები ცვალებადია და წინასწარ შეგატყობინებთ.</li>
                        <li>თანხის დაბრუნება გაიცემა მხოლოდ კონკრეტულ შემთხვევებში, როგორც ეს აღწერილია ჩვენს დაბრუნების პოლიტიკაში.</li>
                      </ul>
                    </div>
                  </div>
                  </section>
                  
                  <section>
                    <h2 className="text-2xl font-semibold mb-4">კონფიდენციალურობის პოლიტიკა</h2>
                    <p className="mb-6">ჩვენ პატივს ვცემთ თქვენს კონფიდენციალურობას და მზად ვართ დავიცვათ თქვენი პერსონალური მონაცემები.</p>
                    
                    <div className="space-y-6">
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">1. ინფორმაცია ჩვენ ვაგროვებთ</h3>
                        <p className="mb-2">ჩვენ ვაგროვებთ:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>პერსონალური მონაცემები (მაგ. სახელი, ელფოსტა, გადახდის დეტალები) რეგისტრაციისას.</li>
                          <li>გამოყენების მონაცემები (მაგ., IP მისამართი, მოწყობილობის ინფორმაცია, დათვალიერების ქცევა).</li>
                          <li>ქუქიები და თვალთვალის ტექნოლოგიები ჩვენი სერვისების გასაუმჯობესებლად.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">2. როგორ ვიყენებთ თქვენს მონაცემებს</h3>
                        <p className="mb-2">ჩვენ ვიყენებთ თქვენს მონაცემებს:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>ჩვენი სერვისების მიწოდება და გაუმჯობესება.</li>
                          <li>გადახდების და ხელმოწერების დამუშავება.</li>
                          <li>კომუნიკაცია და მხარდაჭერა.</li>
                          <li>კანონიერი ვალდებულებების შესრულება.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">3. მონაცემთა დაცვის უფლებები</h3>
                        <p className="mb-2">თქვენ გაქვთ უფლება:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>თქვენს მონაცემებზე წვდომა, შესწორება ან წაშლა.</li>
                          <li>ნებისმიერ დროს გააუქმეთ თანხმობა.</li>
                          <li>ეწინააღმდეგება მონაცემთა დამუშავებას გარკვეულ გარემოებებში.</li>
                          <li>შეიტანეთ საჩივარი მონაცემთა დაცვის ორგანოში.</li>
                        </ul>
                      </div>
                    </div>
                  </section>
                </>}

              {language === 'es' && <>
                  <h1 className="text-3xl font-bold mb-4">Términos y Política de Privacidad</h1>
                  <p className="text-muted-foreground mb-8">Última actualización: 03/03/2025</p>
                  
                  <section className="mb-10">
                    <h2 className="text-2xl font-semibold mb-4">Términos de Servicio</h2>
                    <p className="mb-6">Bienvenido a Smartbookly.com. Estos Términos de Servicio ("Términos") rigen el uso de nuestra plataforma SaaS y nuestros servicios ("Servicios"). Al acceder o utilizar nuestros Servicios, usted acepta estos Términos. Si no los acepta, le rogamos que no utilice nuestros Servicios.</p>
                    
                    <div className="space-y-6">
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">1. Información General</h3>
                        <p className="mb-1">Nombre de la empresa: AI SOFTWARE FACTORY LTD</p>
                        <p className="mb-1">Registrada en: <a href="https://mrueqpffzauvdxmuwhfa.supabase.co/storage/v1/object/sign/event_attachments/db1c8d7c-a9d4-4cbb-9124-071123d66930/9cae890f-15d2-4f4e-aa01-b32477019b6d.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InN0b3JhZ2UtdXJsLXNpZ25pbmcta2V5X2UxYWUwMTczLTA1ZDctNDQ3Zi05NzE5LWU2ZDg1MDE1MzNlNiJ9.eyJ1cmwiOiJldmVudF9hdHRhY2htZW50cy9kYjFjOGQ3Yy1hOWQ0LTRjYmItOTEyNC0wNzExMjNkNjY5MzAvOWNhZTg5MGYtMTVkMi00ZjRlLWFhMDEtYjMyNDc3MDE5YjZkLnBkZiIsImlhdCI6MTc0Nzg1MzExMiwiZXhwIjoxNzQ3ODU2NzEyfQ.2rewdJEA6E0TPRE131HOG8ynA5QqXpPKL6IeZpj3LiI" target="_blank" rel="noopener noreferrer">UK Companies House</a></p>
                        <p>Correo electrónico de contacto: info@smartbookly.com</p>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">2. Requisitos</h3>
                        <p>Debe tener al menos 18 años para utilizar nuestros Servicios. Al utilizar nuestra plataforma, confirma que cumple con este requisito.</p>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">3. Registro y Seguridad de la Cuenta</h3>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Debe proporcionar información precisa y completa al crear una cuenta.</li>
                          <li>Usted es responsable de mantener la confidencialidad de su cuenta y contraseña.</li>
                          <li>Notifíquenos de inmediato cualquier acceso no autorizado a su cuenta.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">4. Uso Aceptable</h3>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Usted se compromete a no hacer un uso indebido de nuestros Servicios ni a infringir las leyes aplicables.</li>
                          <li>No debe cometer fraude, distribuir malware ni infringir derechos de propiedad intelectual.</li>
                          <li>Nos reservamos el derecho de suspender o cancelar las cuentas que infrinjan estas normas.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">5. Pagos y suscripciones</h3>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Los servicios pueden requerir una suscripción de pago, facturada de forma recurrente.</li>
                          <li>Los precios están sujetos a cambios y le notificaremos con antelación.</li>
                          <li>Los reembolsos se emiten solo en casos específicos, como se describe en nuestra Política de reembolsos.</li>
                        </ul>
                      </div>
                    </div>
                  </section>
                  
                  <section>
                    <h2 className="text-2xl font-semibold mb-4">Política de privacidad</h2>
                    <p className="mb-6">Respetamos su privacidad y nos comprometemos a proteger sus datos personales.</p>
                    
                    <div className="space-y-6">
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">1. Información que recopilamos</h3>
                        <p className="mb-2">Recopilamos:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Datos personales (p. ej., nombre, correo electrónico, detalles de pago) al registrarse.</li>
                          <li>Datos de uso (p. ej., dirección IP, información del dispositivo, comportamiento de navegación).</li>
                          <li>Cookies y tecnologías de seguimiento para mejorar nuestros Servicios.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">2. Cómo usamos sus datos</h3>
                        <p className="mb-2">Utilizamos sus datos para:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Prestar y mejorar nuestros Servicios.</li>
                          <li>Procesar pagos y suscripciones.</li>
                          <li>Comunicación y soporte.</li>
                          <li>Cumplir con las obligaciones legales.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">3. Derechos de Protección de Datos</h3>
                        <p className="mb-2">Tiene derecho a:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Acceder, corregir o eliminar sus datos.</li>
                          <li>Retirar su consentimiento en cualquier momento.</li>
                          <li>Oponerse al tratamiento de datos en determinadas circunstancias.</li>
                          <li>Presentar una reclamación ante una autoridad de protección de datos.</li>
                        </ul>
                      </div>
                    </div>
                  </section>
                </>}

              {language === 'en' && <>
                  <h1 className="text-3xl font-bold mb-4">Terms and Privacy Policy</h1>
                  <p className="text-muted-foreground mb-8">Last Updated: 03.03.2025</p>
                  
                  <section className="mb-10">
                    <h2 className="text-2xl font-semibold mb-4">Terms of Service</h2>
                    <p className="mb-6">Welcome to Smartbookly.com. These Terms of Service ("Terms") govern your use of our SaaS platform and services ("Services"). By accessing or using our Services, you agree to these Terms. If you do not agree, please do not use our Services.</p>
                    
                    <div className="space-y-6">
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">1. General Information</h3>
                        <p className="mb-1">Company Name: AI SOFTWARE FACTORY LTD</p>
                        <p className="mb-1">Registered in: <a href="https://mrueqpffzauvdxmuwhfa.supabase.co/storage/v1/object/sign/event_attachments/db1c8d7c-a9d4-4cbb-9124-071123d66930/9cae890f-15d2-4f4e-aa01-b32477019b6d.pdf?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InN0b3JhZ2UtdXJsLXNpZ25pbmcta2V5X2UxYWUwMTczLTA1ZDctNDQ3Zi05NzE5LWU2ZDg1MDE1MzNlNiJ9.eyJ1cmwiOiJldmVudF9hdHRhY2htZW50cy9kYjFjOGQ3Yy1hOWQ0LTRjYmItOTEyNC0wNzExMjNkNjY5MzAvOWNhZTg5MGYtMTVkMi00ZjRlLWFhMDEtYjMyNDc3MDE5YjZkLnBkZiIsImlhdCI6MTc0Nzg1MzExMiwiZXhwIjoxNzQ3ODU2NzEyfQ.2rewdJEA6E0TPRE131HOG8ynA5QqXpPKL6IeZpj3LiI" target="_blank" rel="noopener noreferrer">UK Companies House</a></p>
                        <p>Contact Email: info@smartbookly.com</p>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">2. Eligibility</h3>
                        <p>You must be at least 18 years old to use our Services. By using our platform, you confirm that you meet this requirement.</p>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">3. Account Registration & Security</h3>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>You must provide accurate and complete information when creating an account.</li>
                          <li>You are responsible for maintaining the confidentiality of your account and password.</li>
                          <li>Notify us immediately of any unauthorized access to your account.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">4. Acceptable Use</h3>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>You agree not to misuse our Services or violate any applicable laws.</li>
                          <li>You must not engage in fraud, distribute malware, or infringe on intellectual property rights.</li>
                          <li>We reserve the right to suspend or terminate accounts violating these rules.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">5. Payments & Subscriptions</h3>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Services may require a paid subscription, billed on a recurring basis.</li>
                          <li>Prices are subject to change, and we will notify you in advance.</li>
                          <li>Refunds are issued only in specific cases as outlined in our Refund Policy.</li>
                        </ul>
                      </div>
                    </div>
                  </section>
                  
                  <section>
                    <h2 className="text-2xl font-semibold mb-4">Privacy Policy</h2>
                    <p className="mb-6">We respect your privacy and are committed to protecting your personal data.</p>
                    
                    <div className="space-y-6">
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">1. Information We Collect</h3>
                        <p className="mb-2">We collect:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Personal data (e.g., name, email, payment details) when you register.</li>
                          <li>Usage data (e.g., IP address, device information, browsing behavior).</li>
                          <li>Cookies and tracking technologies to improve our Services.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">2. How We Use Your Data</h3>
                        <p className="mb-2">We use your data for:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Providing and improving our Services.</li>
                          <li>Processing payments and subscriptions.</li>
                          <li>Communication and support.</li>
                          <li>Compliance with legal obligations.</li>
                        </ul>
                      </div>
                      
                      <div className="p-4 rounded-md bg-muted">
                        <h3 className="text-xl font-semibold mb-2">3. Data Protection Rights</h3>
                        <p className="mb-2">You have the right to:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Access, correct, or delete your data.</li>
                          <li>Withdraw consent at any time.</li>
                          <li>Object to data processing in certain circumstances.</li>
                          <li>File a complaint with a data protection authority.</li>
                        </ul>
                      </div>
                    </div>
                  </section>
                </>}
            </LanguageText>
            
            <section className="mt-10 pt-6 border-t border-border">
              <h3 className="text-xl font-semibold mb-2">
                <LanguageText>
                  {language === 'ka' ? 'დაგვიკავშირდით' : language === 'es' ? 'Contáctenos' : 'Contact Us'}
                </LanguageText>
              </h3>
              <p>
                <LanguageText>
                  {language === 'ka' ? 'თუ თქვენ გაქვთ რაიმე შეკითხვები ჩვენს პირობებთან ან კონფიდენციალურობის პოლიტიკასთან დაკავშირებით, გთხოვთ დაგვიკავშირდეთ ' : language === 'es' ? 'Si tiene alguna pregunta sobre nuestros Términos o Política de Privacidad, contáctenos en ' : 'If you have any questions about our Terms or Privacy Policy, please contact us at '}
                </LanguageText>
                <a href="mailto:info@smartbookly.com" className="text-primary hover:underline">info@smartbookly.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>;
};
export default Legal;
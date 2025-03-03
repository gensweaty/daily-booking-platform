
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

const Legal = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-8">
        <nav className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => window.history.back()}
              className="hover:bg-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={theme === 'dark' 
                  ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png"
                  : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"
                }
                alt="SmartBookly Logo" 
                className="h-8 md:h-10 w-auto"
              />
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
            <h1 className="text-3xl font-bold mb-4">Terms of Service & Privacy Policy</h1>
            <p className="text-muted-foreground mb-8">Last Updated: 03.03.2025</p>
            
            <section className="mb-10">
              <h2 className="text-2xl font-semibold mb-4">Terms of Service</h2>
              <p className="mb-6">Welcome to Taskify Minder. These Terms of Service ("Terms") govern your use of our SaaS platform and services ("Services"). By accessing or using our Services, you agree to these Terms. If you do not agree, please do not use our Services.</p>
              
              <div className="space-y-6">
                <div className="p-4 rounded-md bg-muted">
                  <h3 className="text-xl font-semibold mb-2">1. General Information</h3>
                  <p className="mb-1">Company Name: Smartbookly</p>
                  <p className="mb-1">Registered in: Georgia</p>
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
            
            <section className="mt-10 pt-6 border-t border-border">
              <h3 className="text-xl font-semibold mb-2">Contact Us</h3>
              <p>If you have any questions about our Terms or Privacy Policy, please contact us at <a href="mailto:info@smartbookly.com" className="text-primary hover:underline">info@smartbookly.com</a></p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Legal;

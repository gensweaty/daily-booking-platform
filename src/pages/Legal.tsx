
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Legal = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="container mx-auto px-4 py-8">
        <nav className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.history.back()}
            className="hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link to="/" className="text-2xl font-bold text-primary hover:text-primary/90">
            Taskify Minder
          </Link>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto prose dark:prose-invert">
          <h1 className="text-3xl font-bold mb-8">Terms of Service & Privacy Policy</h1>
          <p className="text-muted-foreground">Last Updated: 08.02.2025</p>

          <section className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">Terms of Service</h2>
            <p>Welcome to Taskify Minder. These Terms of Service ("Terms") govern your use of our SaaS platform and services ("Services"). By accessing or using our Services, you agree to these Terms. If you do not agree, please do not use our Services.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">1. General Information</h3>
            <p>
              Company Name: Taskify Minder<br />
              Registered in: Georgia<br />
              Contact Email: support@taskifyminder.com
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">2. Eligibility</h3>
            <p>You must be at least 18 years old to use our Services. By using our platform, you confirm that you meet this requirement.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">3. Account Registration & Security</h3>
            <ul>
              <li>You must provide accurate and complete information when creating an account.</li>
              <li>You are responsible for maintaining the confidentiality of your account and password.</li>
              <li>Notify us immediately of any unauthorized access to your account.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">4. Acceptable Use</h3>
            <ul>
              <li>You agree not to misuse our Services or violate any applicable laws.</li>
              <li>You must not engage in fraud, distribute malware, or infringe on intellectual property rights.</li>
              <li>We reserve the right to suspend or terminate accounts violating these rules.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">5. Payments & Subscriptions</h3>
            <ul>
              <li>Services may require a paid subscription, billed on a recurring basis.</li>
              <li>Prices are subject to change, and we will notify you in advance.</li>
              <li>Refunds are issued only in specific cases as outlined in our Refund Policy.</li>
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">Privacy Policy</h2>
            <p>We respect your privacy and are committed to protecting your personal data.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">1. Information We Collect</h3>
            <p>We collect:</p>
            <ul>
              <li>Personal data (e.g., name, email, payment details) when you register.</li>
              <li>Usage data (e.g., IP address, device information, browsing behavior).</li>
              <li>Cookies and tracking technologies to improve our Services.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">2. How We Use Your Data</h3>
            <p>We use your data for:</p>
            <ul>
              <li>Providing and improving our Services.</li>
              <li>Processing payments and subscriptions.</li>
              <li>Communication and support.</li>
              <li>Compliance with legal obligations.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">3. Data Protection Rights</h3>
            <p>You have the right to:</p>
            <ul>
              <li>Access, correct, or delete your data.</li>
              <li>Withdraw consent at any time.</li>
              <li>Object to data processing in certain circumstances.</li>
              <li>File a complaint with a data protection authority.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Contact Us</h3>
            <p>If you have any questions about our Terms or Privacy Policy, please contact us at support@taskifyminder.com</p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Legal;

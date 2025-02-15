
import { Link } from "react-router-dom";
import { Facebook, Twitter, Instagram, Linkedin, Github } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const FooterSection = () => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  
  const socialLinks = [{
    icon: Facebook,
    href: "#",
    label: "Facebook"
  }, {
    icon: Twitter,
    href: "#",
    label: "Twitter"
  }, {
    icon: Instagram,
    href: "#",
    label: "Instagram"
  }, {
    icon: Linkedin,
    href: "#",
    label: "LinkedIn"
  }, {
    icon: Github,
    href: "#",
    label: "GitHub"
  }];
  
  const navLinks = [{
    label: t('nav.signin'),
    href: "/login"
  }, {
    label: t('nav.signup'),
    href: "/signup"
  }, {
    label: t('nav.contact'),
    href: "/contact"
  }, {
    label: t('footer.legal'),
    href: "/legal"
  }];

  return <footer className="relative py-16">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/5" />
      <div className="container mx-auto px-4 relative">
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-2">
              <img src={theme === 'dark' ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png" : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"} alt="SmartBookly Logo" className="h-8 md:h-10 w-auto" />
            </Link>
            <p className="text-muted-foreground max-w-md">
              {t('footer.description')}
            </p>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              {socialLinks.map((social, index) => {
                const Icon = social.icon;
                return <motion.a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer" whileHover={{
                  scale: 1.1
                }} className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors" initial={{
                  opacity: 0,
                  y: 20
                }} animate={{
                  opacity: 1,
                  y: 0
                }} transition={{
                  delay: index * 0.1
                }}>
                      <Icon className="w-5 h-5 text-primary" />
                      <span className="sr-only">{social.label}</span>
                    </motion.a>;
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold mb-4">{t('footer.navigation')}</h4>
              <ul className="space-y-2">
                {navLinks.slice(0, 3).map((link, index) => <motion.li key={link.label} initial={{
                  opacity: 0,
                  x: -20
                }} animate={{
                  opacity: 1,
                  x: 0
                }} transition={{
                  delay: index * 0.1
                }}>
                      <Link to={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    </motion.li>)}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">{t('footer.legal')}</h4>
              <ul className="space-y-2">
                {navLinks.slice(3).map((link, index) => <motion.li key={link.label} initial={{
                  opacity: 0,
                  x: -20
                }} animate={{
                  opacity: 1,
                  x: 0
                }} transition={{
                  delay: index * 0.1
                }}>
                      <Link to={link.href} className="text-muted-foreground hover:text-foreground transition-colors">
                        {link.label}
                      </Link>
                    </motion.li>)}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t">
          <p className="text-sm text-center text-muted-foreground">{t('footer.rights')}</p>
        </div>
      </div>
    </footer>;
};

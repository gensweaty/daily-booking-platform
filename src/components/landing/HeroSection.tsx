
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";

export const HeroSection = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black/20"></div>
      
      {/* Animated background shapes */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/10 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/5 rounded-full blur-2xl animate-pulse delay-500"></div>
      </div>

      <div className={`relative z-10 text-center text-white px-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
          {language === 'ka' ? (
            <GeorgianAuthText className="block">
              <span className="block">თქვენი ყველაზე დიდი</span>
              <span className="block text-yellow-300">პროდუქტიულობის</span>
              <span className="block">ცენტრი</span>
            </GeorgianAuthText>
          ) : (
            <>
              <span className="block"><LanguageText>{t('hero.yourUltimate')}</LanguageText></span>
              <span className="block text-yellow-300"><LanguageText>{t('hero.productivity')}</LanguageText></span>
              <span className="block"><LanguageText>{t('hero.hub')}</LanguageText></span>
            </>
          )}
        </h1>
        
        <p className="text-lg md:text-xl mb-8 text-white/90 max-w-3xl mx-auto leading-relaxed">
          {language === 'ka' ? (
            <GeorgianAuthText>
              შექმენით, მართეთ და შეისრულეთ თქვენი ყველა დავალება ერთ ადგილას.
              ორგანიზება, რომელიც აღზრდის წარმატებას.
            </GeorgianAuthText>
          ) : (
            <LanguageText>{t('hero.description')}</LanguageText>
          )}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {user ? (
            <Link to="/dashboard">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-4 rounded-full shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-white/20">
                {language === 'ka' ? (
                  <span className="hidden md:inline">
                    <GeorgianAuthText fontWeight="bold">მართვის პანელი</GeorgianAuthText>
                  </span>
                ) : (
                  <span className="hidden md:inline">
                    <LanguageText>{t('hero.goToDashboard')}</LanguageText>
                  </span>
                )}
                {language === 'ka' ? (
                  <span className="md:hidden">
                    <GeorgianAuthText fontWeight="bold">პანელი</GeorgianAuthText>
                  </span>
                ) : (
                  <span className="md:hidden">
                    <LanguageText>{t('hero.dashboard')}</LanguageText>
                  </span>
                )}
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/signup">
                <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-4 rounded-full shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-white/20">
                  {language === 'ka' ? (
                    <GeorgianAuthText fontWeight="bold">დაიწყეთ უფასოდ</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t('hero.getStarted')}</LanguageText>
                  )}
                </Button>
              </Link>
              <Link to="/signin">
                <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white hover:text-purple-600 text-lg px-8 py-4 rounded-full shadow-2xl backdrop-blur-sm bg-white/10 transform transition-all duration-300 hover:scale-105">
                  {language === 'ka' ? (
                    <GeorgianAuthText fontWeight="bold">შესვლა</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t('hero.signIn')}</LanguageText>
                  )}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

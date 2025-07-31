
import { Button } from "@/components/ui/button"
import { ProfileButton } from "@/components/dashboard/ProfileButton"
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { ThemeToggle } from "@/components/ThemeToggle"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Link } from "react-router-dom"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { LanguageText } from "@/components/shared/LanguageText"
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText"

export const DashboardHeader = () => {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [currentLogo, setCurrentLogo] = useState<string>("/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png")

  useEffect(() => {
    setMounted(true)
    updateLogoForTheme()
  }, [])

  const updateLogoForTheme = () => {
    const isDarkTheme = 
      document.documentElement.classList.contains('dark') || 
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      (resolvedTheme || theme) === 'dark'
    
    const newLogoSrc = isDarkTheme 
      ? "/lovable-uploads/cfb84d8d-bdf9-4515-9179-f707416ece03.png" 
      : "/lovable-uploads/d1ee79b8-2af0-490e-969d-9101627c9e52.png"
    
    setCurrentLogo(newLogoSrc)
  }

  useEffect(() => {
    if (!mounted) return

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent
      const newTheme = customEvent.detail?.theme
      updateLogoForTheme()
    }

    document.addEventListener('themeChanged', handleThemeChange)
    document.addEventListener('themeInit', handleThemeChange)
    
    return () => {
      document.removeEventListener('themeChanged', handleThemeChange)
      document.removeEventListener('themeInit', handleThemeChange)
    }
  }, [mounted, theme, resolvedTheme])

  useEffect(() => {
    if (mounted) {
      updateLogoForTheme()
    }
  }, [theme, resolvedTheme, mounted])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return t("dashboard.goodMorning")
    if (hour < 17) return t("dashboard.goodAfternoon")
    return t("dashboard.goodEvening")
  }

  const isGeorgian = language === 'ka'

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[95%] xl:max-w-[92%] 2xl:max-w-[90%] mx-auto">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <img 
              src={currentLogo}
              alt="SmartBookly Logo" 
              className="h-8 w-auto transition-transform duration-200 hover:scale-105"
            />
          </Link>
          
          {/* Enhanced Welcome Message */}
          <div className="hidden md:flex flex-col ml-6">
            <h1 className="text-xl font-semibold text-foreground/90 leading-tight">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {isGeorgian ? (
                  <GeorgianAuthText fontWeight="semibold">კეთილი იყოს თქვენი დაბრუნება</GeorgianAuthText>
                ) : (
                  <LanguageText>{t("dashboard.welcomeBack")}</LanguageText>
                )}
              </span>
            </h1>
            <span className="text-sm text-muted-foreground/80 font-medium tracking-wide">
              {isGeorgian ? (
                <GeorgianAuthText fontWeight="normal" letterSpacing="0.5px">
                  თქვენი პროდუქტიულობის ცენტრი
                </GeorgianAuthText>
              ) : (
                <LanguageText>{t("dashboard.productivityHub")}</LanguageText>
              )}
            </span>
          </div>

          {/* Mobile Welcome - Simplified */}
          <div className="flex md:hidden flex-col ml-2">
            <h1 className="text-lg font-medium text-foreground/90">
              <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {isGeorgian ? (
                  <GeorgianAuthText fontWeight="medium">დაბრუნება</GeorgianAuthText>
                ) : (
                  <LanguageText>Welcome</LanguageText>
                )}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <ProfileButton />
        </div>
      </div>
    </header>
  )
}

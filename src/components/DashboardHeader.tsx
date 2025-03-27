
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { LanguageSwitcher } from "./LanguageSwitcher"
import { ThemeToggle } from "./ThemeToggle"
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useNavigate } from "react-router-dom"
import { BusinessButton } from "./business/BusinessButton"

interface DashboardHeaderProps {
  username?: string
}

export const DashboardHeader = ({ username }: DashboardHeaderProps) => {
  const { signOut } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/signin')
  }

  return (
    <header className="border-b mb-6">
      <div className="flex h-16 items-center px-4 container mx-auto">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[250px] sm:w-[300px]">
            <nav className="flex flex-col gap-4 mt-8">
              <Button variant="ghost" asChild>
                <a href="/">{t("dashboard.home")}</a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="/dashboard">{t("dashboard.dashboard")}</a>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
        <a
          href="/"
          className="ml-4 md:ml-0 text-xl font-bold tracking-tight flex-1 text-foreground flex items-center"
        >
          SmartBookly
        </a>
        <nav className="hidden md:flex items-center gap-4 mr-4">
          <Button variant="ghost" asChild>
            <a href="/">{t("dashboard.home")}</a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="/dashboard">{t("dashboard.dashboard")}</a>
          </Button>
          <BusinessButton />
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <div className="hidden md:flex items-center gap-2 ml-2">
            <span className="text-sm font-medium">{username || 'User'}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              {t("dashboard.signOut")}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

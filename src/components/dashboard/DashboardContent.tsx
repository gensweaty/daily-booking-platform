import { useState, useEffect } from "react";
import { Calendar } from "@/components/Calendar/Calendar";
import { TaskList } from "@/components/task/TaskList";
import { NoteList } from "@/components/note/NoteList";
import { ReminderList } from "@/components/reminder/ReminderList";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { ModeToggle } from "@/components/shared/ModeToggle";
import { MainNav } from "@/components/shared/MainNav";
import { SidebarNav } from "@/components/shared/SidebarNav";
import { MobileSidebar } from "@/components/shared/MobileSidebar";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { UserNav } from "@/components/shared/UserNav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Link } from "lucide-react";

interface DashboardContentProps {
  sidebarItems: {
    title: string;
    href: string;
    icon: keyof typeof Icons;
  }[];
}

export function DashboardContent({ sidebarItems }: DashboardContentProps) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton className="h-12 w-[80%]" />;
  }

  if (loading) {
    return <Skeleton className="h-12 w-[80%]" />;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  return (
    <>
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <MobileSidebar sidebarItems={sidebarItems} />
          <MainNav className="mx-6" />
          <div className="ml-auto flex items-center space-x-4">
            <ModeToggle />
            <UserNav />
          </div>
        </div>
      </div>
      <div className="container relative hidden h-[calc(100vh-4rem)] flex-col space-y-6 p-10 md:flex lg:max-w-5xl">
        <ScrollArea className="h-[calc(100vh-9rem)]  pb-20">
          <div className="mx-auto flex w-full max-w-2xl flex-col space-y-2">
            <h1 className={isGeorgian ? "text-3xl font-bold tracking-tight font-georgian" : "text-3xl font-bold tracking-tight"}>
              {isGeorgian ? (
                <GeorgianAuthText>
                  {t("dashboard.welcome")} {user?.email}
                </GeorgianAuthText>
              ) : (
                <LanguageText>
                  {t("dashboard.welcome")} {user?.email}
                </LanguageText>
              )}
            </h1>
            <p className="text-muted-foreground">
              {isGeorgian ? (
                <GeorgianAuthText>
                  {t("dashboard.overview")}
                </GeorgianAuthText>
              ) : (
                <LanguageText>
                  {t("dashboard.overview")}
                </LanguageText>
              )}
            </p>
          </div>
          <Separator className="my-6" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {isGeorgian ? (
                    <GeorgianAuthText>
                      {t("dashboard.tasks")}
                    </GeorgianAuthText>
                  ) : (
                    <LanguageText>
                      {t("dashboard.tasks")}
                    </LanguageText>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TaskList />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  {isGeorgian ? (
                    <GeorgianAuthText>
                      {t("dashboard.notes")}
                    </GeorgianAuthText>
                  ) : (
                    <LanguageText>
                      {t("dashboard.notes")}
                    </LanguageText>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <NoteList />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  {isGeorgian ? (
                    <GeorgianAuthText>
                      {t("dashboard.reminders")}
                    </GeorgianAuthText>
                  ) : (
                    <LanguageText>
                      {t("dashboard.reminders")}
                    </LanguageText>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReminderList />
              </CardContent>
            </Card>
            <Card className="col-span-2 row-span-2">
              <CardHeader>
                <CardTitle>
                  {isGeorgian ? (
                    <GeorgianAuthText>
                      {t("dashboard.calendar")}
                    </GeorgianAuthText>
                  ) : (
                    <LanguageText>
                      {t("dashboard.calendar")}
                    </LanguageText>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pl-2 flex-row">
                
                <CalendarComponent />
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}

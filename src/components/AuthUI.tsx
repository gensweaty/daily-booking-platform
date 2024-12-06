import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignIn } from "@/components/SignIn";
import { SignUp } from "@/components/SignUp";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

interface AuthUIProps {
  defaultTab?: "signin" | "signup";
}

export const AuthUI = ({ defaultTab = "signin" }: AuthUIProps) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const location = useLocation();

  useEffect(() => {
    // Update active tab based on URL path
    if (location.pathname === "/signup") {
      setActiveTab("signup");
    } else if (location.pathname === "/login") {
      setActiveTab("signin");
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background p-4">
      <header className="mb-8">
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2 text-center">Welcome to Taskify Minder Note</h1>
        <p className="text-foreground/80 text-center">Complete Agile productivity - tasks notes calendar all in one</p>
      </header>

      <div className="w-full max-w-md mx-auto">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "signin" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignIn />
          </TabsContent>
          <TabsContent value="signup">
            <SignUp />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
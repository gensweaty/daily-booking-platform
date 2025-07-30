
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, QrCode, Share2, User, Calendar } from "lucide-react";
import { BusinessProfileForm } from "./BusinessProfileForm";
import { BookingRequestsList } from "./BookingRequestsList";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useBookingRequests } from "@/hooks/useBookingRequests";
import { useLanguage } from "@/contexts/LanguageContext";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { LanguageText } from "@/components/shared/LanguageText";
import QRCode from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";

export const BusinessPage = () => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';
  const { user } = useAuth();
  const { businessProfile } = useBusinessProfile();
  const { pendingRequests } = useBookingRequests();
  const [activeTab, setActiveTab] = useState("profile");
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);

  const businessUrl = businessProfile?.slug 
    ? `${window.location.origin}/business/${businessProfile.slug}`
    : null;

  const pendingCount = pendingRequests?.length || 0;

  const shareProfile = async () => {
    if (!businessUrl) return;
    
    if (navigator.share && window.innerWidth <= 768) {
      try {
        await navigator.share({
          title: businessProfile?.business_name || 'My Business',
          text: businessProfile?.description || 'Check out my business profile',
          url: businessUrl,
        });
      } catch (error) {
        console.log('Error sharing:', error);
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    if (!businessUrl) return;
    
    navigator.clipboard.writeText(businessUrl);
  };

  useEffect(() => {
    if (pendingCount > 0) {
      setActiveTab("booking-requests");
    }
  }, [pendingCount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <motion.h1 
          className={`text-2xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent hover:from-primary hover:via-primary/90 hover:to-primary/70 transition-all duration-300 cursor-default ${isGeorgian ? 'font-georgian' : ''}`}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          {isGeorgian ? (
            <GeorgianAuthText fontWeight="bold">ჩემი ბიზნესი</GeorgianAuthText>
          ) : (
            <LanguageText>{t("business.myBusiness")}</LanguageText>
          )}
        </motion.h1>
        
        {businessUrl && (
          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="hover:bg-accent/50 hover:border-accent transition-all duration-200 hover:shadow-sm"
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-center">
                      <LanguageText>Scan QR code</LanguageText>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col items-center space-y-4 p-6">
                    <QRCode 
                      value={businessUrl} 
                      size={200}
                      level="M"
                      includeMargin={true}
                    />
                    <p className="text-sm text-muted-foreground text-center">
                      <LanguageText>Scan this QR code to share your business profile</LanguageText>
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                onClick={shareProfile}
                className="bg-green-500 hover:bg-green-600 text-white transition-all duration-200 shadow-md hover:shadow-lg"
                size="sm"
              >
                <Share2 className="h-4 w-4 mr-1" />
                {isGeorgian ? (
                  <GeorgianAuthText fontWeight="bold">გაზიარება</GeorgianAuthText>
                ) : (
                  <LanguageText>share</LanguageText>
                )}
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button 
                onClick={() => window.open(businessUrl, '_blank')}
                className="bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 shadow-md hover:shadow-lg"
                size="sm"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                {isGeorgian ? (
                  <GeorgianAuthText fontWeight="bold">საჯარო გვერდი</GeorgianAuthText>
                ) : (
                  <LanguageText>View Public Page</LanguageText>
                )}
              </Button>
            </motion.div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="bg-muted/30 border border-border/50 rounded-lg p-1 mb-4">
          <TabsList className="grid w-full grid-cols-2 bg-transparent p-0 gap-1 h-auto">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <TabsTrigger 
                value="profile" 
                className="flex items-center gap-2 text-sm text-foreground transition-all duration-300 bg-transparent rounded-md px-4 py-3 hover:bg-muted/60 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50"
              >
                <User className="w-4 h-4" />
                <span>
                  {isGeorgian ? (
                    <GeorgianAuthText>ბიზნეს პროფილი</GeorgianAuthText>
                  ) : (
                    <LanguageText>Business Profile</LanguageText>
                  )}
                </span>
              </TabsTrigger>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <TabsTrigger 
                value="booking-requests" 
                className="flex items-center gap-2 text-sm text-foreground transition-all duration-300 bg-transparent rounded-md px-4 py-3 hover:bg-muted/60 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border/50 relative"
              >
                <Calendar className="w-4 h-4" />
                <span>
                  {isGeorgian ? (
                    <GeorgianAuthText>ჯავშნის მოთხოვნები</GeorgianAuthText>
                  ) : (
                    <LanguageText>Booking Requests</LanguageText>
                  )}
                </span>
                {pendingCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <Badge 
                      variant="destructive" 
                      className="ml-1 px-1.5 py-0.5 text-xs bg-orange-500 hover:bg-orange-600 animate-pulse"
                    >
                      {pendingCount}
                    </Badge>
                  </motion.div>
                )}
              </TabsTrigger>
            </motion.div>
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-0">
          <BusinessProfileForm />
        </TabsContent>

        <TabsContent value="booking-requests" className="mt-0">
          <BookingRequestsList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

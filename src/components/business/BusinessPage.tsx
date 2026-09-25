import { BusinessProfileForm } from "./BusinessProfileForm";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BookingRequestsList } from "./BookingRequestsList";
import { useBookingRequests } from "@/hooks/useBookingRequests";
import { Badge } from "@/components/ui/badge";
import { Building2, CalendarCheck2, ExternalLink, QrCode, Share, Bell, MessageCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import QRCode from "qrcode.react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { BookingNotificationManager } from "./BookingNotificationManager";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { BusinessPageSkeleton, BusinessEmptyState } from "./BusinessPageSkeleton";
import { EmbedCodeCard } from "./EmbedCodeCard";
import SmsSettingsSection from "./SmsSettingsSection";

export const BusinessPage = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"profile" | "bookings" | "sms">("profile");
  const { bookingRequests, pendingRequests, approvedRequests, rejectedRequests, approveRequest, rejectRequest, deleteBookingRequest, refetch } = useBookingRequests();
  const pendingCount = pendingRequests?.length || 0;
  const isGeorgian = language === 'ka';
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  // Use the centralized hook - no duplicate query
  const { businessProfile, isLoading } = useBusinessProfile();

  // Auto-select "bookings" if profile exists, "profile" if not
  useEffect(() => {
    if (!isLoading) {
      if (businessProfile) {
        setActiveTab("bookings");
      } else {
        setActiveTab("profile");
      }
    }
  }, [businessProfile, isLoading]);

  // Listen for tutorial tab switching
  useEffect(() => {
    const handleSwitchBusinessTab = (e: CustomEvent<{ tab: string }>) => {
      const tab = e.detail?.tab;
      if (tab === 'profile' || tab === 'bookings' || tab === 'sms') {
        setActiveTab(tab as "profile" | "bookings" | "sms");
      }
    };
    window.addEventListener('switch-business-tab', handleSwitchBusinessTab as EventListener);
    return () => {
      window.removeEventListener('switch-business-tab', handleSwitchBusinessTab as EventListener);
    };
  }, []);

  // Handle new booking request notifications
  const handleNewBookingRequest = () => {
    console.log('New booking request detected, refreshing data and showing notification...');
    
    // Show immediate notification about new request
    const isGeorgian = language === 'ka';
    toast({
      title: isGeorgian ? "ახალი ჯავშნის მოთხოვნა მოვიდა!" : "New Booking Request Received!",
      description: isGeorgian 
        ? "გადახედეთ და დაამტკიცეთ ახალი მოთხოვნა"
        : "Please review and approve the new request",
      duration: 12000,
      className: "bg-orange-50 border-orange-200 text-orange-900 shadow-lg",
      action: (
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4" />
          <span className="font-medium">
            {isGeorgian ? "იხილეთ" : "View"}
          </span>
        </div>
      ),
    });
    
    // Switch to bookings tab if not already there
    if (activeTab !== "bookings") {
      setActiveTab("bookings");
    }
    
    // Refresh the booking requests data
    refetch();
  };

  // Show skeleton while loading (including when user auth is still resolving)
  if (isLoading || (!businessProfile && !user)) {
    return <BusinessPageSkeleton />;
  }

  const publicUrl = businessProfile?.slug 
    ? `${window.location.protocol}//${window.location.host}/business/${businessProfile.slug}`
    : null;

  const handleTabChange = (value: string) => {
    if (value === "profile" || value === "bookings" || value === "sms") {
      setActiveTab(value);
    }
  };

  const handleShare = async () => {
    if (!publicUrl) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: businessProfile?.business_name || "Business Profile",
          text: isGeorgian ? "გთხოვთ იხილოთ ჩემი ჯავშნის გვერდი:" : "Please visit my booking page:",
          url: publicUrl
        });
      } catch (err) {
        console.error("Error sharing:", err);
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    if (!publicUrl) return;
    
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast({
        title: isGeorgian ? "ლინკი დაკოპირდა!" : "Link copied to clipboard!"
      });
    }).catch(err => {
      console.error("Error copying to clipboard:", err);
    });
  };

  const renderViewPublicPageButton = () => {
    if (!publicUrl) return null;
    
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ExternalLink className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {isGeorgian ? "საჯარო გვერდი" : language === "es" ? "Página pública" : "Public page"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isGeorgian ? "გაუზიარეთ კლიენტებს ჯავშნის ბმული" : language === "es" ? "Comparte tu enlace de reservas" : "Share your booking link with customers"}
              </p>
            </div>
          </div>
        <Button 
          variant="info"
          onClick={() => window.open(publicUrl, '_blank')}
          className="flex items-center gap-2 w-full"
        >
          <LanguageText>{t("business.viewPublicPage")}</LanguageText>
          <ExternalLink className="h-4 w-4" />
        </Button>
        </div>
        
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex w-full items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary/10 text-secondary">
              <QrCode className="h-4 w-4" />
            </span>
            <div className="text-sm font-semibold">
            <LanguageText>{t("business.scanQrCode")}</LanguageText>
          </div>
          
          <div 
            onClick={() => setQrDialogOpen(true)}
            className="cursor-pointer rounded-md bg-white p-3 transition-opacity hover:opacity-90"
          >
            <QRCode 
              value={publicUrl}
              size={120}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"L"}
              includeMargin={false}
              className="rounded-md"
            />
          </div>
          
          <Button
            onClick={handleShare}
            variant="secondary" 
            className="mt-3 w-full flex items-center justify-center gap-2"
          >
            <Share className="h-4 w-4" />
            {isGeorgian ? (
              <span>გაზიარება</span>
            ) : (
              <LanguageText>{t("common.share")}</LanguageText>
            )}
          </Button>
        </div>
        
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md p-6">
            <div className="flex flex-col items-center justify-center">
              <h3 className="text-lg font-medium mb-4">
                {isGeorgian ? (
                  "დაასკანერეთ QR კოდი"
                ) : (
                  <LanguageText>{t("business.scanQrCode")}</LanguageText>
                )}
              </h3>
              <div className="bg-white p-4 rounded-md">
                <QRCode 
                  value={publicUrl}
                  size={240}
                  bgColor={"#ffffff"}
                  fgColor={"#000000"}
                  level={"L"}
                  includeMargin={false}
                  className="rounded-md"
                />
              </div>
              <Button
                onClick={handleShare}
                variant="secondary" 
                className="mt-4 flex items-center justify-center gap-2"
              >
                <Share className="h-4 w-4" />
                {isGeorgian ? (
                  <span>გაზიარება</span>
                ) : (
                  <LanguageText>{t("common.share")}</LanguageText>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  const tabCopy = {
    profile: isGeorgian ? "ბიზნეს პროფილი" : t("business.businessProfile"),
    bookings: t("business.bookingRequests"),
    sms: isGeorgian ? "SMS პარამეტრები" : language === "es" ? "Ajustes de SMS" : "SMS Settings",
  };

  const pageDescription = isGeorgian
    ? "მართეთ თქვენი საჯარო გვერდი, ჯავშნები და SMS შეტყობინებები"
    : language === "es"
      ? "Gestiona tu página pública, reservas y mensajes SMS"
      : "Manage your public page, bookings and SMS messages";

  const renderSectionHeading = (key: string) => {
    if (isGeorgian) {
      if (key === "business.pendingRequests") return <GeorgianAuthText>მოთხოვნები მოლოდინში</GeorgianAuthText>;
      if (key === "business.approvedRequests") return <GeorgianAuthText>დადასტურებული მოთხოვნები</GeorgianAuthText>;
      if (key === "business.rejectedRequests") return <GeorgianAuthText>უარყოფილი მოთხოვნები</GeorgianAuthText>;
      return <LanguageText>{t(key)}</LanguageText>;
    }
    return <LanguageText>{t(key)}</LanguageText>;
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <BookingNotificationManager 
        businessProfileId={businessProfile?.id || null}
        onNewRequest={handleNewBookingRequest}
      />
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="border-b bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">
                {isGeorgian ? <GeorgianAuthText>ჩემი ბიზნესი</GeorgianAuthText> : <LanguageText>{t("business.myBusiness")}</LanguageText>}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{pageDescription}</p>
            </div>
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg border bg-background p-1 shadow-sm xl:w-auto xl:min-w-[560px]">
          <TabsTrigger 
            value="profile" 
            data-tutorial="business-profile-tab"
            className="min-h-11 gap-2 px-2 text-xs transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm"
          >
            <Building2 className="hidden h-4 w-4 sm:block" />
            <span className="min-w-0 whitespace-normal text-center leading-tight">{tabCopy.profile}</span>
          </TabsTrigger>
          <TabsTrigger 
            value="bookings" 
            className="relative min-h-11 gap-2 px-2 text-xs transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm"
          >
            <CalendarCheck2 className="hidden h-4 w-4 sm:block" />
            <span className="min-w-0 whitespace-normal text-center leading-tight">{tabCopy.bookings}</span>
            {pendingCount > 0 && (
              <Badge 
                variant="orange" 
                className="absolute -top-2 -right-2 flex items-center justify-center h-5 min-w-5 p-0 text-xs animate-pulse"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="sms"
            className="min-h-11 gap-2 px-2 text-xs transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground sm:px-4 sm:text-sm"
          >
            <MessageCircle className="hidden h-4 w-4 sm:block" />
            <span className="min-w-0 whitespace-normal text-center leading-tight">{tabCopy.sms}</span>
          </TabsTrigger>
        </TabsList>
          </div>
        </div>

        <TabsContent value="profile" className="m-0">
          <div className="grid items-start lg:grid-cols-[minmax(0,1fr)_280px]">
            <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
              {publicUrl && businessProfile?.slug && <EmbedCodeCard slug={businessProfile.slug} isGeorgian={isGeorgian} />}
              <BusinessProfileForm />
            </main>
            {publicUrl && <aside className="border-t bg-muted/10 p-4 sm:p-6 lg:sticky lg:top-4 lg:border-l lg:border-t-0">{renderViewPublicPageButton()}</aside>}
          </div>
        </TabsContent>

        <TabsContent value="sms" className="m-0">
          <div className="grid items-start lg:grid-cols-[minmax(0,1fr)_280px]">
            <main className="min-w-0 p-4 sm:p-6 lg:p-8"><SmsSettingsSection /></main>
            {publicUrl && <aside className="border-t bg-muted/10 p-4 sm:p-6 lg:sticky lg:top-4 lg:border-l lg:border-t-0">{renderViewPublicPageButton()}</aside>}
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="m-0">
          <div className="grid items-start lg:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0 space-y-7 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                <LanguageText>{t("business.bookingRequests")}</LanguageText>
              </h1>
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full animate-pulse">
                  <Bell className="h-4 w-4" />
                  <span className="font-medium">
                    {pendingCount} <LanguageText>{pendingCount === 1 ? t("common.new") : t("common.new")}</LanguageText>{" "}
                    <LanguageText>{pendingCount === 1 ? t("common.request") : t("common.requests")}</LanguageText>
                  </span>
                </div>
              )}
            </div>
            
          </div>

          <div className="space-y-7">
            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                {renderSectionHeading("business.pendingRequests")} 
                <Badge variant="orange" className="ml-2">({pendingRequests.length})</Badge>
              </h2>
              <BookingRequestsList
                requests={pendingRequests}
                onApprove={(id, ownerNote) => approveRequest({ bookingId: id, ownerNote })}
                onReject={rejectRequest}
                onDelete={deleteBookingRequest}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                {renderSectionHeading("business.approvedRequests")}
                <Badge variant="green" className="ml-2">({approvedRequests.length})</Badge>
              </h2>
              <BookingRequestsList
                requests={approvedRequests}
                onDelete={deleteBookingRequest}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                {renderSectionHeading("business.rejectedRequests")}
                <Badge variant="destructive" className="ml-2">({rejectedRequests.length})</Badge>
              </h2>
              <BookingRequestsList
                requests={rejectedRequests}
                onDelete={deleteBookingRequest}
              />
            </div>
          </div>
          </main>
          {publicUrl && <aside className="border-t bg-muted/10 p-4 sm:p-6 lg:sticky lg:top-4 lg:border-l lg:border-t-0">{renderViewPublicPageButton()}</aside>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

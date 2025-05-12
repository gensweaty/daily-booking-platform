
import { BusinessProfileForm } from "./BusinessProfileForm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BookingRequestsList } from "./BookingRequestsList";
import { useBookingRequests } from "@/hooks/useBookingRequests";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, ExternalLink, QrCode, Share } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import QRCode from "qrcode.react"; // Fixed import statement
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export const BusinessPage = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<"profile" | "bookings">("profile");
  const { bookingRequests, pendingRequests, approvedRequests, rejectedRequests, approveRequest, rejectRequest, deleteBookingRequest } = useBookingRequests();
  const pendingCount = pendingRequests?.length || 0;
  const isGeorgian = language === 'ka';
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: businessProfile, isLoading } = useQuery({
    queryKey: ["businessProfile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Auto-select "bookings" if profile exists, "profile" if not
  useEffect(() => {
    if (businessProfile) {
      setActiveTab("bookings");
    } else {
      setActiveTab("profile");
    }
  }, [businessProfile]);

  if (isLoading) {
    return <div className="text-center p-8"><LanguageText>{t("common.loading")}</LanguageText></div>;
  }

  const publicUrl = businessProfile?.slug 
    ? `${window.location.protocol}//${window.location.host}/business/${businessProfile.slug}`
    : null;

  // Create a type-safe handler for tab changes
  const handleTabChange = (value: string) => {
    if (value === "profile" || value === "bookings") {
      setActiveTab(value);
    }
  };

  // Function to handle sharing the QR code URL
  const handleShare = async () => {
    if (!publicUrl) return;
    
    // Use the Web Share API if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: businessProfile?.name || t("business.businessProfile"),
          text: t("business.shareBusinessText"),
          url: publicUrl,
        });
      } catch (error) {
        console.error("Error sharing:", error);
        // Fallback to copying to clipboard if share is cancelled or fails
        copyToClipboard();
      }
    } else {
      // Fallback for browsers that don't support the Web Share API
      copyToClipboard();
    }
  };

  // Fallback function to copy link to clipboard
  const copyToClipboard = () => {
    if (!publicUrl) return;
    
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast({
        title: t("common.success"),
        description: t("business.linkCopied"),
        variant: "default", // Changed from "success" to "default"
      });
    }).catch((err) => {
      console.error("Failed to copy:", err);
    });
  };

  // Helper function for the View Public Page button
  const renderViewPublicPageButton = () => {
    if (!publicUrl) return null;
    
    return (
      <div className="flex flex-col gap-4">
        <Button 
          variant="info"
          onClick={() => window.open(publicUrl, '_blank')}
          className="flex items-center gap-2 w-full"
        >
          <LanguageText>{t("business.viewPublicPage")}</LanguageText>
          <ExternalLink className="h-4 w-4" />
        </Button>
        
        <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border">
          <div className="text-sm text-gray-500 mb-2">
            <LanguageText>{t("business.scanQrCode")}</LanguageText>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="cursor-pointer relative group"
                  onClick={() => setQrDialogOpen(true)}
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
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-md flex items-center justify-center">
                    <QrCode className="h-8 w-8 text-primary/0 group-hover:text-primary/70 transition-all" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p><LanguageText>{t("business.qrCodeTooltip")}</LanguageText></p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Share button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="mt-3 w-full flex gap-2 items-center justify-center"
          >
            <Share className="h-4 w-4" />
            <LanguageText>{t("common.share")}</LanguageText>
          </Button>
        </div>
      </div>
    );
  };

  // Helper to render proper Georgian text for section headings
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
    <div className="space-y-6">
      {/* QR Code Dialog for enlarged view */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <LanguageText>{t("business.qrCodeTitle")}</LanguageText>
            </DialogTitle>
            <DialogDescription>
              <LanguageText>{t("business.qrCodeDescription")}</LanguageText>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center p-4">
            {publicUrl && (
              <>
                <QRCode 
                  value={publicUrl}
                  size={250}
                  bgColor={"#ffffff"}
                  fgColor={"#000000"}
                  level={"L"}
                  includeMargin={true}
                  className="rounded-md mb-4"
                />
                <div className="text-sm text-center mb-4 max-w-md overflow-hidden text-ellipsis">
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                    {publicUrl}
                  </a>
                </div>
                <Button
                  onClick={handleShare}
                  className="w-full flex gap-2 items-center justify-center"
                >
                  <Share className="h-4 w-4" />
                  <LanguageText>{t("common.share")}</LanguageText>
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-6 bg-background/80 border rounded-lg p-1 shadow-sm">
          <TabsTrigger 
            value="profile" 
            className="data-[state=active]:bg-[#9b87f5] data-[state=active]:text-white transition-all duration-200"
          >
            {isGeorgian ? (
              <GeorgianAuthText>ბიზნეს პროფილი</GeorgianAuthText>
            ) : (
              <LanguageText>{t("business.businessProfile")}</LanguageText>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="bookings" 
            className="relative data-[state=active]:bg-[#9b87f5] data-[state=active]:text-white transition-all duration-200"
          >
            <LanguageText>{t("business.bookingRequests")}</LanguageText>
            {pendingCount > 0 && (
              <Badge 
                variant="orange" 
                className="absolute -top-2 -right-2 flex items-center justify-center h-5 min-w-5 p-0 text-xs"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">
              {isGeorgian ? (
                <GeorgianAuthText>ჩემი ბიზნესი</GeorgianAuthText>
              ) : (
                <LanguageText>{t("business.myBusiness")}</LanguageText>
              )}
            </h1>
            {!isMobile && publicUrl && renderViewPublicPageButton()}
          </div>
          
          {/* View Public Page button and QR code for mobile - positioned below heading */}
          {isMobile && publicUrl && (
            <div className="w-full mb-6">
              {renderViewPublicPageButton()}
            </div>
          )}

          <BusinessProfileForm />
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                <LanguageText>{t("business.bookingRequests")}</LanguageText>
              </h1>
              {pendingCount > 0 && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-3 py-1 rounded-full">
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-medium">
                    {pendingCount} <LanguageText>{pendingCount === 1 ? t("common.new") : t("common.new")}</LanguageText>{" "}
                    <LanguageText>{pendingCount === 1 ? t("common.request") : t("common.requests")}</LanguageText>
                  </span>
                </div>
              )}
            </div>
            
            {/* View Public Page button for mobile - positioned below heading */}
            {isMobile && publicUrl && (
              <div className="w-full mt-3 mb-2">
                {renderViewPublicPageButton()}
              </div>
            )}
            
            {/* View Public Page button for desktop - positioned to the right */}
            {!isMobile && publicUrl && (
              <div className="min-w-[180px]">
                {renderViewPublicPageButton()}
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                {renderSectionHeading("business.pendingRequests")} 
                <Badge variant="orange" className="ml-2">({pendingRequests.length})</Badge>
              </h2>
              <BookingRequestsList
                requests={pendingRequests}
                type="pending"
                onApprove={approveRequest}
                onReject={rejectRequest}
                onDelete={deleteBookingRequest}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                {renderSectionHeading("business.approvedRequests")}
                <Badge variant="green" className="ml-2">({approvedRequests.length})</Badge>
              </h2>
              <BookingRequestsList
                requests={approvedRequests}
                type="approved"
                onDelete={deleteBookingRequest}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                {renderSectionHeading("business.rejectedRequests")}
                <Badge variant="destructive" className="ml-2">({rejectedRequests.length})</Badge>
              </h2>
              <BookingRequestsList
                requests={rejectedRequests}
                type="rejected"
                onDelete={deleteBookingRequest}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

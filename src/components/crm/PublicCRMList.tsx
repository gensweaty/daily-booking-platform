import { PresenceAvatars } from "@/components/PresenceAvatars";
import { useLanguage } from "@/contexts/LanguageContext";
import { PublicCRMWithPermissions } from "./PublicCRMWithPermissions";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface PublicCRMListProps {
  boardUserId: string;
  externalUserName: string;
  externalUserEmail: string;
  onlineUsers: { name: string; email: string }[];
}

export const PublicCRMList = ({ 
  boardUserId, 
  externalUserName, 
  externalUserEmail, 
  onlineUsers 
}: PublicCRMListProps) => {
  const { t } = useLanguage();
  const isMobile = useMediaQuery("(max-width: 640px)");

  return (
    <div className="space-y-6">
      {/* Mobile: Header line with CRM left, circles center */}
      <div className="grid sm:hidden grid-cols-[auto_1fr] items-center w-full">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.crm')}</h2>
        <div className="flex items-center justify-center">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      {/* Desktop: Header with presence left aligned */}
      <div className="hidden sm:flex flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">{t('dashboard.crm')}</h2>
        <div className="flex items-center gap-3">
          <PresenceAvatars users={onlineUsers} currentUserEmail={externalUserEmail} max={5} />
        </div>
      </div>

      {/* Full CRM functionality with permissions */}
      <PublicCRMWithPermissions 
        boardUserId={boardUserId}
        externalUserName={externalUserName}
        externalUserEmail={externalUserEmail}
      />
    </div>
  );
};
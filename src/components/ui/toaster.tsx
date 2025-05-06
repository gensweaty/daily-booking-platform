
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useLanguage } from "@/contexts/LanguageContext"
import { cn } from "@/lib/utils"
import { getGeorgianFontStyle } from "@/lib/font-utils"

export function Toaster() {
  const { toasts } = useToast()
  const { language } = useLanguage()
  const isGeorgian = language === 'ka'

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && (
                <ToastTitle 
                  className={cn(isGeorgian && "font-georgian")}
                  style={isGeorgian ? getGeorgianFontStyle() : undefined}
                >
                  {title}
                </ToastTitle>
              )}
              {description && (
                <ToastDescription 
                  className={cn(isGeorgian && "font-georgian")}
                  style={isGeorgian ? getGeorgianFontStyle() : undefined}
                >
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

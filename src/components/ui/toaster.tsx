
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";

export function Toaster() {
  const { toasts } = useToast()
  const { language } = useLanguage();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, translateParams, translateKeys, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && (
                <ToastTitle>
                  {translateKeys?.titleKey ? (
                    <LanguageText>{translateKeys.titleKey}</LanguageText>
                  ) : (
                    title
                  )}
                </ToastTitle>
              )}
              
              {description && (
                <ToastDescription translateParams={translateParams}>
                  {translateKeys?.descriptionKey ? (
                    <LanguageText>{translateKeys.descriptionKey}</LanguageText>
                  ) : (
                    description
                  )}
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

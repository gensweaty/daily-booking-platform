
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/LanguageContext"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  const { t } = useLanguage()
  
  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, translateKeys, translateParams, ...props }) {
        let finalTitle = title
        let finalDescription = description
        
        // Handle translation keys if provided
        if (translateKeys) {
          if (translateKeys.titleKey) {
            finalTitle = t(translateKeys.titleKey)
          }
          if (translateKeys.descriptionKey) {
            finalDescription = t(translateKeys.descriptionKey)
          }
        }
        
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {finalTitle && <ToastTitle>{finalTitle}</ToastTitle>}
              {finalDescription && (
                <ToastDescription translateParams={translateParams}>
                  {finalDescription}
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

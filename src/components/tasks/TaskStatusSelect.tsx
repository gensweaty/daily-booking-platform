
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "../shared/LanguageText";
import { cn } from "@/lib/utils";
import { Circle, Clock, CheckCircle } from "lucide-react";
import { Task } from "@/lib/types";

interface TaskStatusSelectProps {
  status: Task['status'];
  setStatus: (status: Task['status']) => void;
}

export const TaskStatusSelect = ({ status, setStatus }: TaskStatusSelectProps) => {
  const { t, language } = useLanguage();
  const isGeorgian = language === 'ka';

  const statusOptions = [
    {
      value: 'todo' as const,
      label: t("tasks.todo"),
      icon: Circle,
      color: "text-muted-foreground"
    },
    {
      value: 'inprogress' as const,
      label: t("tasks.inProgress"),
      icon: Clock,
      color: "text-blue-600"
    },
    {
      value: 'done' as const,
      label: t("tasks.done"),
      icon: CheckCircle,
      color: "text-green-600"
    }
  ];

  const currentOption = statusOptions.find(option => option.value === status);

  // Get the proper status label based on language
  const getStatusLabel = () => {
    switch (language) {
      case 'ka':
        return 'სტატუსი';
      case 'es':
        return 'Estado';
      default:
        return 'Status';
    }
  };

  return (
    <div className="space-y-2">
      <Label 
        htmlFor="status"
        className={cn(isGeorgian ? "font-georgian" : "")}
        style={isGeorgian ? {fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"} : undefined}
      >
        <LanguageText>{getStatusLabel()}</LanguageText>
      </Label>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger 
          id="status"
          className={cn("bg-background border-input", isGeorgian ? "font-georgian" : "")}
          style={isGeorgian ? {fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"} : undefined}
        >
          <SelectValue>
            {currentOption && (
              <div className="flex items-center gap-2">
                <currentOption.icon className={cn("h-4 w-4", currentOption.color)} />
                <span>{currentOption.label}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-background border">
          {statusOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className={cn("bg-background hover:bg-accent", isGeorgian ? "font-georgian" : "")}
              style={isGeorgian ? {fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif"} : undefined}
            >
              <div className="flex items-center gap-2">
                <option.icon className={cn("h-4 w-4", option.color)} />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

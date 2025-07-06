
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, CalendarIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageText } from "@/components/shared/LanguageText";
import { GeorgianAuthText } from "@/components/shared/GeorgianAuthText";
import { FileUploadField } from "@/components/shared/FileUploadField";
import { getRepeatOptions } from "@/lib/recurringEvents";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

interface AdditionalPerson {
  id: string;
  userSurname: string;
  userNumber: string;
  socialNetworkLink: string;
  eventNotes: string;
  paymentStatus: string;
  paymentAmount: string;
}

interface EventDialogFieldsProps {
  title: string;
  setTitle: (value: string) => void;
  userSurname: string;
  setUserSurname: (value: string) => void;
  userNumber: string;
  setUserNumber: (value: string) => void;
  socialNetworkLink: string;
  setSocialNetworkLink: (value: string) => void;
  eventNotes: string;
  setEventNotes: (value: string) => void;
  eventName: string;
  setEventName: (value: string) => void;
  paymentStatus: string;
  setPaymentStatus: (value: string) => void;
  paymentAmount: string;
  setPaymentAmount: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  repeatPattern: string;
  setRepeatPattern: (value: string) => void;
  repeatUntil: string;
  setRepeatUntil: (value: string) => void;
  files: File[];
  setFiles: (files: File[]) => void;
  additionalPersons: AdditionalPerson[];
  setAdditionalPersons: (persons: AdditionalPerson[]) => void;
  isNewEvent: boolean;
}

export const EventDialogFields = ({
  title,
  setTitle,
  userSurname,
  setUserSurname,
  userNumber,
  setUserNumber,
  socialNetworkLink,
  setSocialNetworkLink,
  eventNotes,
  setEventNotes,
  eventName,
  setEventName,
  paymentStatus,
  setPaymentStatus,
  paymentAmount,
  setPaymentAmount,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  isRecurring,
  setIsRecurring,
  repeatPattern,
  setRepeatPattern,
  repeatUntil,
  setRepeatUntil,
  files,
  setFiles,
  additionalPersons,
  setAdditionalPersons,
  isNewEvent
}: EventDialogFieldsProps) => {
  const { language, t } = useLanguage();
  const isGeorgian = language === 'ka';
  
  const georgianStyle = isGeorgian ? {
    fontFamily: "'BPG Glaho WEB Caps', 'DejaVu Sans', 'Arial Unicode MS', sans-serif",
    letterSpacing: '-0.2px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale'
  } : undefined;

  const selectedDate = startDate ? new Date(startDate) : undefined;
  const repeatOptions = getRepeatOptions(selectedDate, t);

  const addAdditionalPerson = () => {
    const newPerson: AdditionalPerson = {
      id: crypto.randomUUID(),
      userSurname: "",
      userNumber: "",
      socialNetworkLink: "",
      eventNotes: "",
      paymentStatus: "",
      paymentAmount: ""
    };
    setAdditionalPersons([...additionalPersons, newPerson]);
  };

  const removeAdditionalPerson = (id: string) => {
    setAdditionalPersons(additionalPersons.filter(person => person.id !== id));
  };

  const updateAdditionalPerson = (id: string, field: keyof AdditionalPerson, value: string) => {
    setAdditionalPersons(additionalPersons.map(person => 
      person.id === id ? { ...person, [field]: value } : person
    ));
  };

  // Parse the repeatUntil date for the calendar
  const repeatUntilDate = repeatUntil ? new Date(repeatUntil) : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <div>
          <Label htmlFor="title" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? (
              <GeorgianAuthText letterSpacing="-0.05px">სათაური</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.title")}</LanguageText>
            )}
          </Label>
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          />
        </div>

        <div>
          <Label htmlFor="userSurname" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? (
              <GeorgianAuthText letterSpacing="-0.05px">სრული სახელი</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.fullName")}</LanguageText>
            )}
          </Label>
          <Input
            id="userSurname"
            type="text"
            value={userSurname}
            onChange={(e) => setUserSurname(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          />
        </div>

        <div>
          <Label htmlFor="userNumber" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? (
              <GeorgianAuthText letterSpacing="-0.05px">ტელეფონის ნომერი</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.phoneNumber")}</LanguageText>
            )}
          </Label>
          <Input
            id="userNumber"
            type="tel"
            value={userNumber}
            onChange={(e) => setUserNumber(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          />
        </div>

        <div>
          <Label htmlFor="socialNetworkLink" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? (
              <GeorgianAuthText letterSpacing="-0.05px">ელფოსტა</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.socialLinkEmail")}</LanguageText>
            )}
          </Label>
          <Input
            id="socialNetworkLink"
            type="email"
            value={socialNetworkLink}
            onChange={(e) => setSocialNetworkLink(e.target.value)}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          />
        </div>

        <div>
          <Label htmlFor="eventNotes" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
            {isGeorgian ? (
              <GeorgianAuthText letterSpacing="-0.05px">შენიშვნები</GeorgianAuthText>
            ) : (
              <LanguageText>{t("events.eventNotes")}</LanguageText>
            )}
          </Label>
          <Textarea
            id="eventNotes"
            value={eventNotes}
            onChange={(e) => setEventNotes(e.target.value)}
            placeholder={isGeorgian ? "დაამატეთ შენიშვნები თქვენი ჯავშნის შესახებ" : t("events.addEventNotes")}
            className={cn(isGeorgian ? "font-georgian" : "")}
            style={georgianStyle}
          />
        </div>

        <FileUploadField
          files={files}
          setFiles={setFiles}
        />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">დაწყება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("events.start")}</LanguageText>
              )}
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            />
          </div>

          <div>
            <Label htmlFor="endDate" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">დასრულება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("events.end")}</LanguageText>
              )}
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            />
          </div>
        </div>

        {isNewEvent && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="isRecurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
              <Label htmlFor="isRecurring" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                {isGeorgian ? (
                  <GeorgianAuthText letterSpacing="-0.05px">გამეორება</GeorgianAuthText>
                ) : (
                  <LanguageText>{t("recurring.repeat")}</LanguageText>
                )}
              </Label>
            </div>

            {isRecurring && (
              <div className="space-y-3">
                <div>
                  <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? (
                      <GeorgianAuthText letterSpacing="-0.05px">გამეორების ტიპი</GeorgianAuthText>
                    ) : (
                      <LanguageText>Repeat Pattern</LanguageText>
                    )}
                  </Label>
                  <Select value={repeatPattern} onValueChange={setRepeatPattern}>
                    <SelectTrigger className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      <SelectValue placeholder={isGeorgian ? "აირჩიეთ გამეორების ტიპი" : "Select repeat pattern"} />
                    </SelectTrigger>
                    <SelectContent>
                      {repeatOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    {isGeorgian ? (
                      <GeorgianAuthText letterSpacing="-0.05px">გამეორება მდე</GeorgianAuthText>
                    ) : (
                      <LanguageText>{t("recurring.repeatUntil")}</LanguageText>
                    )}
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !repeatUntilDate && "text-muted-foreground",
                          isGeorgian ? "font-georgian" : ""
                        )}
                        style={georgianStyle}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {repeatUntilDate ? (
                          format(repeatUntilDate, "PPP")
                        ) : (
                          <span>
                            {isGeorgian ? (
                              <GeorgianAuthText letterSpacing="-0.05px">აირჩიეთ თარიღი</GeorgianAuthText>
                            ) : (
                              "Pick a date"
                            )}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={repeatUntilDate}
                        onSelect={(date) => {
                          if (date) {
                            // Format as YYYY-MM-DD for the backend
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setRepeatUntil(`${year}-${month}-${day}`);
                          } else {
                            setRepeatUntil("");
                          }
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">გადახდის სტატუსი</GeorgianAuthText>
              ) : (
                <LanguageText>{t("events.paymentStatus")}</LanguageText>
              )}
            </Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                <SelectValue placeholder={isGeorgian ? "აირჩიეთ გადახდის სტატუსი" : t("events.selectPaymentStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  {isGeorgian ? (
                    <GeorgianAuthText letterSpacing="-0.05px">გადაუხდელი</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t("crm.notPaid")}</LanguageText>
                  )}
                </SelectItem>
                <SelectItem value="paid_partly" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  {isGeorgian ? (
                    <GeorgianAuthText letterSpacing="-0.05px">ნაწილობრივ გადახდილი</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t("crm.paidPartly")}</LanguageText>
                  )}
                </SelectItem>
                <SelectItem value="paid_fully" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  {isGeorgian ? (
                    <GeorgianAuthText letterSpacing="-0.05px">სრულად გადახდილი</GeorgianAuthText>
                  ) : (
                    <LanguageText>{t("crm.paidFully")}</LanguageText>
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="paymentAmount" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">გადახდის თანხა</GeorgianAuthText>
              ) : (
                <LanguageText>{t("events.paymentAmount")}</LanguageText>
              )}
            </Label>
            <Input
              id="paymentAmount"
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={cn("text-lg font-medium", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">დამატებითი პირები</GeorgianAuthText>
              ) : (
                "Additional Persons"
              )}
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAdditionalPerson}
              className={cn(isGeorgian ? "font-georgian" : "")}
              style={georgianStyle}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isGeorgian ? (
                <GeorgianAuthText letterSpacing="-0.05px">დამატება</GeorgianAuthText>
              ) : (
                <LanguageText>{t("common.add")}</LanguageText>
              )}
            </Button>
          </div>

          {additionalPersons.map((person, index) => (
            <div key={person.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className={cn("font-medium", isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                  {isGeorgian ? (
                    <GeorgianAuthText letterSpacing="-0.05px">პირი {index + 1}</GeorgianAuthText>
                  ) : (
                    `Person ${index + 1}`
                  )}
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeAdditionalPerson(person.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder={isGeorgian ? "სრული სახელი" : t("events.fullName")}
                  value={person.userSurname}
                  onChange={(e) => updateAdditionalPerson(person.id, 'userSurname', e.target.value)}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                />
                <Input
                  placeholder={isGeorgian ? "ტელეფონის ნომერი" : t("events.phoneNumber")}
                  value={person.userNumber}
                  onChange={(e) => updateAdditionalPerson(person.id, 'userNumber', e.target.value)}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                />
              </div>

              <Input
                placeholder={isGeorgian ? "ელფოსტა" : t("events.socialLinkEmail")}
                type="email"
                value={person.socialNetworkLink}
                onChange={(e) => updateAdditionalPerson(person.id, 'socialNetworkLink', e.target.value)}
                className={cn(isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              />

              <Textarea
                placeholder={isGeorgian ? "შენიშვნები" : t("events.eventNotes")}
                value={person.eventNotes}
                onChange={(e) => updateAdditionalPerson(person.id, 'eventNotes', e.target.value)}
                className={cn(isGeorgian ? "font-georgian" : "")}
                style={georgianStyle}
              />

              <div className="grid grid-cols-2 gap-3">
                <Select 
                  value={person.paymentStatus} 
                  onValueChange={(value) => updateAdditionalPerson(person.id, 'paymentStatus', value)}
                >
                  <SelectTrigger className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                    <SelectValue placeholder={isGeorgian ? "გადახდის სტატუსი" : t("events.paymentStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_paid" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? (
                        <GeorgianAuthText letterSpacing="-0.05px">გადაუხდელი</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("crm.notPaid")}</LanguageText>
                      )}
                    </SelectItem>
                    <SelectItem value="paid_partly" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? (
                        <GeorgianAuthText letterSpacing="-0.05px">ნაწილობრივ გადახდილი</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("crm.paidPartly")}</LanguageText>
                      )}
                    </SelectItem>
                    <SelectItem value="paid_fully" className={cn(isGeorgian ? "font-georgian" : "")} style={georgianStyle}>
                      {isGeorgian ? (
                        <GeorgianAuthText letterSpacing="-0.05px">სრულად გადახდილი</GeorgianAuthText>
                      ) : (
                        <LanguageText>{t("crm.paidFully")}</LanguageText>
                      )}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  placeholder={isGeorgian ? "გადახდის თანხა" : t("events.paymentAmount")}
                  type="number"
                  step="0.01"
                  value={person.paymentAmount}
                  onChange={(e) => updateAdditionalPerson(person.id, 'paymentAmount', e.target.value)}
                  className={cn(isGeorgian ? "font-georgian" : "")}
                  style={georgianStyle}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

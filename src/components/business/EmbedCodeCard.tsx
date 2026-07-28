import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Code2, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

interface EmbedCodeCardProps {
  slug: string;
  isGeorgian: boolean;
}

export const EmbedCodeCard = ({ slug, isGeorgian }: EmbedCodeCardProps) => {
  const [width, setWidth] = useState("100%");
  const [height, setHeight] = useState("800");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<"en" | "es" | "ka">("en");
  const [showBranding, setShowBranding] = useState(true);
  const [copied, setCopied] = useState(false);

  const params = new URLSearchParams();
  params.set("theme", theme);
  params.set("lang", lang);
  if (!showBranding) params.set("branding", "0");

  const embedUrl = `${window.location.protocol}//${window.location.host}/embed/business/${slug}?${params.toString()}`;
  const widthAttr = /^\d+$/.test(width) ? `${width}px` : width;
  const heightAttr = /^\d+$/.test(height) ? `${height}px` : height;
  const embedCode = `<iframe src="${embedUrl}" style="width:${widthAttr};height:${heightAttr};border:0;border-radius:12px;overflow:hidden;" loading="lazy" title="Booking Calendar"></iframe>`;

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      toast({ title: isGeorgian ? "კოდი დაკოპირდა!" : "Embed code copied!" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const L = {
    title: isGeorgian ? "ჩააშენე ჯავშნის კალენდარი" : "Embed Booking Calendar",
    desc: isGeorgian
      ? "დააკოპირე კოდი და ჩააგდე შენს ვებგვერდზე. მოთხოვნები ავტომატურად გამოჩნდება Booking Requests-ში."
      : "Copy this code and paste it into your website. Requests appear automatically in Booking Requests.",
    width: isGeorgian ? "სიგანე" : "Width",
    height: isGeorgian ? "სიმაღლე" : "Height",
    theme: isGeorgian ? "თემა" : "Theme",
    language: isGeorgian ? "ენა" : "Language",
    branding: isGeorgian ? '"Powered by Smartbookly"' : '"Powered by Smartbookly"',
    copy: copied ? (isGeorgian ? "დაკოპირდა" : "Copied") : (isGeorgian ? "კოდის კოპირება" : "Copy code"),
    preview: isGeorgian ? "გადახედვა" : "Preview",
    light: isGeorgian ? "ღია" : "Light",
    dark: isGeorgian ? "მუქი" : "Dark",
  };

  return (
    <div className="flex-1 w-full rounded-lg border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Code2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">{L.title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{L.desc}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{L.width}</Label>
          <Input value={width} onChange={(e) => setWidth(e.target.value)} placeholder="100%" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{L.height}</Label>
          <Input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="800" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{L.theme}</Label>
          <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{L.light}</SelectItem>
              <SelectItem value="dark">{L.dark}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{L.language}</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as "en" | "es" | "ka")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="ka">ქართული</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="branding-toggle" checked={showBranding} onCheckedChange={setShowBranding} />
        <Label htmlFor="branding-toggle" className="text-sm cursor-pointer">
          {isGeorgian ? "აჩვენე" : "Show"} {L.branding}
        </Label>
      </div>

      <pre className="text-xs bg-muted/50 border rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono">
{embedCode}
      </pre>

      <div className="flex flex-wrap gap-2">
        <Button onClick={copyEmbed} variant="info" className="flex items-center gap-2">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {L.copy}
        </Button>
        <Button
          variant="secondary"
          onClick={() => window.open(embedUrl, "_blank")}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          {L.preview}
        </Button>
      </div>
    </div>
  );
};
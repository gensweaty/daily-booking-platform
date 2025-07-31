
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { OptimizedImage } from "./OptimizedImage";

interface ImageCarouselProps {
  images: {
    src: string;
    alt: string;
    title?: string;
    customStyle?: string;
    customPadding?: string;
  }[];
  className?: string;
  showTitles?: boolean;
  permanentArrows?: boolean;
  objectFit?: "object-contain" | "object-cover" | "object-fill";
  imageHeight?: string;
}

export const ImageCarousel = ({ 
  images, 
  className,
  showTitles = false,
  permanentArrows = false,
  objectFit = "object-contain",
  imageHeight = "h-[400px]"
}: ImageCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [autoSlideEnabled, setAutoSlideEnabled] = useState(false);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });

    // Auto-slide only on desktop and with longer intervals
    let interval: NodeJS.Timeout | null = null;
    
    if (!isMobile && autoSlideEnabled) {
      interval = setInterval(() => {
        api.scrollNext();
      }, 8000); // Slower for better performance
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [api, isMobile, autoSlideEnabled]);

  // Enable auto-slide after user interaction delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setAutoSlideEnabled(true);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  const responsiveHeight = isMobile 
    ? "h-[240px]" 
    : isTablet 
      ? "h-[320px]" 
      : imageHeight;

  return (
    <div className={cn("w-full relative group", className)}>
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        setApi={setApi}
        className="w-full"
      >
        <CarouselContent>
          {images.map((image, index) => (
            <CarouselItem key={index} className="md:basis-1/1">
              <div className="p-1">
                <div className={cn(
                  "rounded-xl overflow-hidden transition-all duration-500 ease-out",
                  responsiveHeight,
                  "enhanced-card gpu-accelerated"
                )}>
                  <div className={cn(
                    "relative h-full w-full flex items-center justify-center",
                    "bg-gradient-to-br from-background/95 via-background/90 to-background/95",
                    image.customPadding || 'p-2',
                    "group/image"
                  )}>
                    <OptimizedImage
                      src={image.src}
                      alt={image.alt}
                      className={cn(
                        "w-full h-full transition-all duration-500 ease-out image-hover-effect",
                        image.customStyle || objectFit,
                        "group-hover/image:brightness-105"
                      )}
                      priority={index === 0}
                    />
                    
                    {showTitles && image.title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent text-white p-3 text-center">
                        <span className="font-medium text-sm drop-shadow-lg">{image.title}</span>
                      </div>
                    )}
                    
                    {/* Subtle highlight overlay - no white background */}
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/1 via-transparent to-primary/1 pointer-events-none opacity-0 group-hover/image:opacity-100 transition-opacity duration-500" />
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        
        <CarouselPrevious 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-all duration-300 button-smooth-hover",
            "absolute left-2 md:-left-12 glass-morphism",
            "border-none shadow-lg hover:shadow-xl",
            "w-8 h-8 md:w-10 md:h-10 rounded-full",
            "hover:bg-white/20 dark:hover:bg-gray-800/30"
          )}
        />
        <CarouselNext 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-all duration-300 button-smooth-hover",
            "absolute right-2 md:-right-12 glass-morphism",
            "border-none shadow-lg hover:shadow-xl",
            "w-8 h-8 md:w-10 md:h-10 rounded-full",
            "hover:bg-white/20 dark:hover:bg-gray-800/30"
          )}
        />
      </Carousel>
      
      {/* Enhanced carousel indicators */}
      {count > 1 && (
        <div className="flex justify-center space-x-2 mt-4">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              className={cn(
                "transition-all duration-300 rounded-full",
                current === index + 1
                  ? "bg-primary w-6 h-2"
                  : "bg-primary/30 hover:bg-primary/60 w-2 h-2"
              )}
              onClick={() => api?.scrollTo(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

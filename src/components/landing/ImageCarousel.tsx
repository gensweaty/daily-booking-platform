
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

    // Only enable auto-slide on desktop and when user is not interacting
    let interval: NodeJS.Timeout | null = null;
    
    if (!isMobile && autoSlideEnabled) {
      interval = setInterval(() => {
        api.scrollNext();
      }, 6000); // Slower auto-slide for better performance
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [api, isMobile, autoSlideEnabled]);

  // Enable auto-slide after initial load to prevent performance impact
  useEffect(() => {
    const timer = setTimeout(() => {
      setAutoSlideEnabled(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  // Determine appropriate height based on screen size
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
                  "rounded-xl overflow-hidden transition-all duration-300",
                  responsiveHeight,
                  "hover:shadow-md enhanced-card"
                )}>
                  <div className={cn(
                    "relative h-full w-full flex items-center justify-center",
                    "bg-gradient-to-br from-white/95 to-white/80 backdrop-blur-sm",
                    image.customPadding || 'p-0',
                    "group"
                  )}>
                    <OptimizedImage
                      src={image.src}
                      alt={image.alt}
                      className={cn(
                        "w-full h-full transition-all duration-300 group-hover:scale-102",
                        image.customStyle || objectFit
                      )}
                      priority={index === 0} // Only first image is priority
                    />
                    
                    {showTitles && image.title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white p-3 text-center backdrop-blur-sm">
                        <span className="font-medium text-sm drop-shadow-lg">{image.title}</span>
                      </div>
                    )}
                    
                    {/* Reduced overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/3 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        
        <CarouselPrevious 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-all duration-300",
            "absolute left-2 md:-left-12 glass-morphism hover:bg-white/90 dark:hover:bg-gray-800/90",
            "border-none shadow-md hover:shadow-lg",
            "w-8 h-8 md:w-9 md:h-9 rounded-full"
          )}
        />
        <CarouselNext 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-all duration-300",
            "absolute right-2 md:-right-12 glass-morphism hover:bg-white/90 dark:hover:bg-gray-800/90",
            "border-none shadow-md hover:shadow-lg",
            "w-8 h-8 md:w-9 md:h-9 rounded-full"
          )}
        />
      </Carousel>
      
      {/* Optimized Carousel Indicators */}
      {count > 1 && (
        <div className="flex justify-center space-x-1 mt-3">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-200",
                current === index + 1
                  ? "bg-primary w-4"
                  : "bg-primary/40 hover:bg-primary/70"
              )}
              onClick={() => api?.scrollTo(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

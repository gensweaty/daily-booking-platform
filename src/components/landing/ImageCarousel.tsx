
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { useEffect, useState, memo, useCallback } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface ImageCarouselProps {
  images: {
    src: string;
    alt: string;
    title?: string;
    customStyle?: string;
    customPadding?: string;
    loading?: 'lazy' | 'eager';
  }[];
  className?: string;
  showTitles?: boolean;
  permanentArrows?: boolean;
  objectFit?: "object-contain" | "object-cover" | "object-fill";
  imageHeight?: string;
}

// Memoized image component for better performance
const CarouselImage = memo(({ 
  src, 
  alt, 
  customStyle, 
  objectFit,
  loading = 'lazy'
}: { 
  src: string; 
  alt: string; 
  customStyle?: string;
  objectFit?: string;
  loading?: 'lazy' | 'eager';
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  return (
    <div className="relative overflow-hidden">
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn(
          "w-full h-full transition-all duration-300 hover:scale-105",
          customStyle || objectFit,
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setIsLoaded(true)}
        style={{ imageRendering: 'auto' }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-background via-muted/20 to-background animate-pulse" />
      )}
    </div>
  );
});

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
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");

  // Memoized interval setup for auto-sliding
  const setupAutoSlide = useCallback(() => {
    if (!api) return;

    const interval = setInterval(() => {
      api.scrollNext();
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [api]);

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    const handleSelect = () => setCurrent(api.selectedScrollSnap() + 1);
    api.on("select", handleSelect);

    // Set up auto-sliding with cleanup
    const cleanup = setupAutoSlide();

    return () => {
      api.off("select", handleSelect);
      cleanup?.();
    };
  }, [api, setupAutoSlide]);

  // Determine appropriate height based on screen size
  const responsiveHeight = isMobile 
    ? "h-[280px]" 
    : isTablet 
      ? "h-[350px]" 
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
                  "rounded-xl overflow-hidden transition-shadow duration-300 hover:shadow-lg",
                  responsiveHeight
                )}>
                  <div className={cn(
                    "relative h-full w-full flex items-center justify-center bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm",
                    image.customPadding || 'p-0'
                  )}>
                    <CarouselImage
                      src={image.src}
                      alt={image.alt}
                      customStyle={image.customStyle}
                      objectFit={objectFit}
                      loading={index === 0 ? 'eager' : 'lazy'} // Load first image eagerly
                    />
                    {showTitles && image.title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white p-4 text-center backdrop-blur-sm">
                        <span className="font-medium drop-shadow-lg">{image.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        
        {/* Optimized navigation arrows */}
        <CarouselPrevious 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-300",
            "absolute left-2 md:-left-16 glass-morphism hover:bg-white/90 dark:hover:bg-gray-800/90",
            "border-none shadow-lg",
            "w-8 h-8 md:w-10 md:h-10 rounded-full",
            "gpu-layer" // GPU acceleration for smooth animations
          )}
        />
        <CarouselNext 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-300",
            "absolute right-2 md:-right-16 glass-morphism hover:bg-white/90 dark:hover:bg-gray-800/90",
            "border-none shadow-lg",
            "w-8 h-8 md:w-10 md:h-10 rounded-full",
            "gpu-layer" // GPU acceleration for smooth animations
          )}
        />
      </Carousel>
      
      {/* Optimized Carousel Indicators */}
      {count > 1 && (
        <div className="flex justify-center space-x-1 mt-4">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300 gpu-layer",
                current === index + 1
                  ? "bg-primary w-6"
                  : "bg-primary/30 hover:bg-primary/60"
              )}
              onClick={() => api?.scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

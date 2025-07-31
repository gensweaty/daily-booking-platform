
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
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });

    // Set up auto-sliding interval
    const interval = setInterval(() => {
      api.scrollNext();
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [api]);

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
                <div className={`rounded-xl overflow-hidden transition-all duration-500 ${responsiveHeight} hover:shadow-lg enhanced-card`}>
                  <div className={`relative h-full w-full flex items-center justify-center bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm ${image.customPadding || 'p-0'} group`}>
                    <img
                      src={image.src}
                      alt={image.alt}
                      className={cn(
                        "w-full h-full transition-all duration-300 group-hover:scale-105",
                        image.customStyle || objectFit
                      )}
                    />
                    {showTitles && image.title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white p-4 text-center backdrop-blur-sm">
                        <span className="font-medium drop-shadow-lg">{image.title}</span>
                      </div>
                    )}
                    {/* Subtle overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-all duration-300 hover:scale-110",
            "absolute left-2 md:-left-16 glass-morphism hover:bg-white/90 dark:hover:bg-gray-800/90",
            "border-none shadow-lg hover:shadow-xl",
            "w-8 h-8 md:w-10 md:h-10 rounded-full"
          )}
        />
        <CarouselNext 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-all duration-300 hover:scale-110",
            "absolute right-2 md:-right-16 glass-morphism hover:bg-white/90 dark:hover:bg-gray-800/90",
            "border-none shadow-lg hover:shadow-xl",
            "w-8 h-8 md:w-10 md:h-10 rounded-full"
          )}
        />
      </Carousel>
      
      {/* Carousel Indicators */}
      {count > 1 && (
        <div className="flex justify-center space-x-1 mt-4">
          {Array.from({ length: count }, (_, index) => (
            <button
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                current === index + 1
                  ? "bg-primary w-6"
                  : "bg-primary/30 hover:bg-primary/60"
              )}
              onClick={() => api?.scrollTo(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

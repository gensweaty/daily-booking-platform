
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
    customStyle?: string; // For custom styling per image
    customPadding?: string; // New prop for custom padding per image
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
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");

  useEffect(() => {
    if (!api) return;

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
                <div className={`rounded-xl overflow-hidden transition-all ${responsiveHeight} hover:shadow-lg`}>
                  <div className={`relative h-full w-full flex items-center justify-center bg-white ${image.customPadding || 'p-0'}`}>
                    <img
                      src={image.src}
                      alt={image.alt}
                      className={cn(
                        "w-full h-full",
                        // Apply custom style per image if provided, otherwise use the default objectFit
                        image.customStyle || objectFit
                      )}
                    />
                    {showTitles && image.title && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-center">
                        {image.title}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-300",
            "absolute left-2 md:-left-16 bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800",
            "border-none shadow-lg hover:shadow-xl",
            "w-8 h-8 md:w-10 md:h-10 rounded-full"
          )}
        />
        <CarouselNext 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-300",
            "absolute right-2 md:-right-16 bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800",
            "border-none shadow-lg hover:shadow-xl",
            "w-8 h-8 md:w-10 md:h-10 rounded-full"
          )}
        />
      </Carousel>
    </div>
  );
}

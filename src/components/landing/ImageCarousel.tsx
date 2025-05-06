
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

interface ImageCarouselProps {
  images: {
    src: string;
    alt: string;
    title?: string;
  }[];
  className?: string;
  showTitles?: boolean;
  permanentArrows?: boolean;
  objectFit?: string; // Prop for controlling object-fit CSS property
  imageHeight?: string; // New prop for controlling image height
}

export const ImageCarousel = ({ 
  images, 
  className,
  showTitles = false,
  permanentArrows = false,
  objectFit = 'object-contain', // Default to object-contain to maintain backward compatibility
  imageHeight = 'h-[400px]' // Default height that was previously hardcoded
}: ImageCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;

    // Set up auto-sliding interval
    const interval = setInterval(() => {
      api.scrollNext();
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [api]);

  return (
    <div className={cn("w-full relative group", className)}>
      <Carousel
        opts={{
          align: "center", // Keeping center alignment
          loop: true,
        }}
        setApi={setApi}
        className="w-full"
      >
        <CarouselContent className="mx-auto"> 
          {images.map((image, index) => (
            <CarouselItem key={index} className="md:basis-1/1 flex justify-center"> 
              <div className="p-1 w-full max-w-[90%] mx-auto"> 
                <div className={`rounded-xl overflow-hidden transition-all ${imageHeight} hover:shadow-lg`}>
                  <div className="relative h-full w-full flex items-center justify-center bg-white">
                    <img
                      src={image.src}
                      alt={image.alt}
                      className={`w-full h-full ${objectFit} p-2`} // Apply padding and dynamic objectFit
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
            "absolute left-2 md:-left-12 bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800",
            "border-none shadow-lg hover:shadow-xl",
            "w-10 h-10 rounded-full"
          )}
        />
        <CarouselNext 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-300",
            "absolute right-2 md:-right-12 bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800",
            "border-none shadow-lg hover:shadow-xl",
            "w-10 h-10 rounded-full"
          )}
        />
      </Carousel>
    </div>
  );
};

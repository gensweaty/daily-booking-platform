
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
}

export const ImageCarousel = ({ 
  images, 
  className,
  showTitles = false,
  permanentArrows = false
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
                <div className="rounded-xl overflow-hidden transition-all h-[400px] hover:shadow-lg">
                  <div className="relative h-full w-full flex items-center justify-center bg-white">
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="w-full h-full object-fill"
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
            "w-10 h-10 rounded-full"
          )}
        />
        <CarouselNext 
          className={cn(
            permanentArrows ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-300",
            "absolute right-2 md:-right-16 bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800",
            "border-none shadow-lg hover:shadow-xl",
            "w-10 h-10 rounded-full"
          )}
        />
      </Carousel>
    </div>
  );
};

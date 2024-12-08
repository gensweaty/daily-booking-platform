import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useCarousel } from "@/components/ui/carousel";

interface ImageCarouselProps {
  images: {
    src: string;
    alt: string;
    title?: string;
  }[];
  className?: string;
}

export const ImageCarousel = ({ images, className }: ImageCarouselProps) => {
  const [api, setApi] = useState<ReturnType<typeof useCarousel>["api"]>();

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
                <div className={cn(
                  "rounded-xl overflow-hidden border shadow-md transition-all",
                  "hover:shadow-lg"
                )}>
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-auto object-cover aspect-video"
                  />
                  {image.title && (
                    <div className="p-4 bg-white">
                      <h3 className="text-lg font-semibold text-center">{image.title}</h3>
                    </div>
                  )}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious 
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            "absolute left-2 md:-left-12 bg-white/80 hover:bg-white",
            "border-none shadow-lg hover:shadow-xl",
            "w-10 h-10 rounded-full"
          )}
        />
        <CarouselNext 
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            "absolute right-2 md:-right-12 bg-white/80 hover:bg-white",
            "border-none shadow-lg hover:shadow-xl",
            "w-10 h-10 rounded-full"
          )}
        />
      </Carousel>
    </div>
  );
};
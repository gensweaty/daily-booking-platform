import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";

interface ImageCarouselProps {
  images: {
    src: string;
    alt: string;
    title?: string;
  }[];
  className?: string;
  showArrows?: boolean;
}

export const ImageCarousel = ({ images, className, showArrows = true }: ImageCarouselProps) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: true,
  });

  useEffect(() => {
    if (emblaApi) {
      const intervalId = setInterval(() => {
        emblaApi.scrollNext();
      }, 5000);

      return () => {
        clearInterval(intervalId);
      };
    }
  }, [emblaApi]);

  return (
    <div className={cn("w-full relative group", className)}>
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent ref={emblaRef}>
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
                    <div className="p-4 bg-white dark:bg-gray-800">
                      <h3 className="text-lg font-semibold text-center">{image.title}</h3>
                    </div>
                  )}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {showArrows && (
          <>
            <CarouselPrevious className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute left-2 md:-left-12" />
            <CarouselNext className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute right-2 md:-right-12" />
          </>
        )}
      </Carousel>
    </div>
  );
};
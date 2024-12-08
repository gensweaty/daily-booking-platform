import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ImageCarouselProps {
  images: {
    src: string;
    alt: string;
    title?: string;
  }[];
  className?: string;
}

export const ImageCarousel = ({ images, className }: ImageCarouselProps) => {
  return (
    <div className={cn("w-full relative group", className)}>
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
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
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
          <CarouselPrevious className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
            <ChevronLeft className="h-4 w-4" />
          </CarouselPrevious>
          <CarouselNext className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
            <ChevronRight className="h-4 w-4" />
          </CarouselNext>
        </div>
      </Carousel>
    </div>
  );
};
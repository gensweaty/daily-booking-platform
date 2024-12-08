import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

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
    <div className={cn("w-full relative", className)}>
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
        <CarouselPrevious className="hidden md:flex -left-12" />
        <CarouselNext className="hidden md:flex -right-12" />
      </Carousel>
    </div>
  );
};
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const views = [
  {
    title: "Day View",
    image: "/lovable-uploads/24b958c2-7db0-408b-ba4a-9942de8506fe.png",
  },
  {
    title: "Week View",
    image: "/lovable-uploads/353b3d3e-37f6-41f9-bbbb-39be3eab16ca.png",
  },
  {
    title: "Month View",
    image: "/lovable-uploads/805e1efb-ab50-42ad-9247-1f8b374cc8a9.png",
  },
];

export const CalendarCarousel = () => {
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent>
          {views.map((view, index) => (
            <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/1">
              <div className="p-1">
                <div className={cn(
                  "rounded-xl overflow-hidden border shadow-md transition-all",
                  "hover:shadow-lg"
                )}>
                  <img
                    src={view.image}
                    alt={view.title}
                    className="w-full h-auto object-cover aspect-video"
                  />
                  <div className="p-4 bg-white">
                    <h3 className="text-lg font-semibold text-center">{view.title}</h3>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>
    </div>
  );
};
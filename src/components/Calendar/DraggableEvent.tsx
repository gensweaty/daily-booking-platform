import { Draggable } from "@hello-pangea/dnd";
import { format, parseISO } from "date-fns";
import { CalendarEventType } from "@/lib/types/calendar";

interface DraggableEventProps {
  event: CalendarEventType;
  index: number;
  style?: React.CSSProperties;
  onClick: (event: CalendarEventType) => void;
}

export const DraggableEvent = ({ event, index, style, onClick }: DraggableEventProps) => {
  const start = parseISO(event.start_date);
  const end = parseISO(event.end_date);

  return (
    <Draggable draggableId={event.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`absolute left-0.5 right-0.5 sm:left-1 sm:right-1 rounded px-1 sm:px-2 py-1 text-xs sm:text-sm ${
            event.type === "meeting"
              ? "bg-[#4338ca] text-white"
              : "bg-[#7c3aed] text-white"
          } cursor-pointer overflow-hidden hover:opacity-80 transition-opacity`}
          style={{
            ...style,
            ...provided.draggableProps.style,
          }}
          onClick={() => onClick(event)}
        >
          <div className="font-semibold truncate">{event.title}</div>
          {(style?.height as number) > 40 && (
            <div className="text-[10px] sm:text-xs truncate">
              {format(start, "h:mm a")} - {format(end, "h:mm a")}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};
"use client";

import { ReactNode, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVerticalIcon } from "@/components/ui";

export interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (newItems: T[]) => void;
  className?: string;
  /**
   * When true, the drag handle is not rendered and the whole row becomes
   * draggable. Defaults to false so clicks on buttons/inputs within the
   * rendered item don't start drags.
   */
  wholeRowDraggable?: boolean;
  itemClassName?: string;
}

function SortableRow({
  id,
  children,
  wholeRowDraggable,
  className,
}: {
  id: string;
  children: ReactNode;
  wholeRowDraggable?: boolean;
  className?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  if (wholeRowDraggable) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={className}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={className}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab select-none rounded-md p-1 text-fg-muted hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
        >
          <DotsSixVerticalIcon size={14} />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function SortableList<T>({
  items,
  getId,
  renderItem,
  onReorder,
  className,
  wholeRowDraggable,
  itemClassName,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const ids = useMemo(() => items.map(getId), [items, getId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableRow
              key={getId(item)}
              id={getId(item)}
              wholeRowDraggable={wholeRowDraggable}
              className={itemClassName}
            >
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

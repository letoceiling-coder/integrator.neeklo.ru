import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/shared/lib/cn';

interface VirtualListProps<T> {
  items: T[];
  estimateSize?: number;
  className?: string;
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => string | number;
}

export function VirtualList<T>({
  items,
  estimateSize = 56,
  className,
  renderItem,
  getKey,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 8,
  });

  return (
    <div ref={parentRef} className={cn('h-full overflow-auto', className)}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const item = items[vRow.index]!;
          const key = getKey?.(item, vRow.index) ?? vRow.key;
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${vRow.size}px`,
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              {renderItem(item, vRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

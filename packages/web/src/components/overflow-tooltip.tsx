import { useDndContext } from '@dnd-kit/core';
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type AriaAttributes,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type TooltipTriggerProps = Pick<AriaAttributes, 'aria-describedby'> & {
  onBlur: () => void;
  onFocus: () => void;
  onKeyDown: KeyboardEventHandler;
  onPointerDown: PointerEventHandler;
  onPointerEnter: PointerEventHandler;
  onPointerLeave: PointerEventHandler;
};

export function OverflowTooltip({
  text,
  children,
}: {
  text: string;
  children: (options: {
    isOverflowing: boolean;
    textRef: (element: HTMLElement | null) => void;
    triggerProps: TooltipTriggerProps;
  }) => ReactNode;
}) {
  const { active } = useDndContext();
  const tooltipId = useId();
  const [textElement, setTextElement] = useState<HTMLElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    triggerTop: number;
  } | null>(null);

  const updateOverflow = useCallback(() => {
    const element = textElement;
    const next = element !== null && element.scrollWidth > element.clientWidth;
    setIsOverflowing(next);
    if (!next) setPosition(null);
    return next;
  }, [textElement]);

  const setTextRef = useCallback((element: HTMLElement | null) => {
    setTextElement(element);
    setIsOverflowing(element !== null && element.scrollWidth > element.clientWidth);
  }, []);

  useEffect(() => {
    const element = textElement;
    if (!element) return;

    const handleResize = () => updateOverflow();
    const handleScroll = () => setPosition(null);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize);
    observer?.observe(element);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      observer?.disconnect();
    };
  }, [text, textElement, updateOverflow]);

  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => setPosition(null));
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const show = () => {
    const element = textElement;
    if (active || !element || !updateOverflow()) return;

    const rect = element.getBoundingClientRect();
    setPosition({
      left: rect.left + rect.width / 2,
      top: rect.bottom + 8,
      triggerTop: rect.top,
    });
  };

  const hide = () => setPosition(null);
  const setTooltipRef = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;

    const rect = element.getBoundingClientRect();
    setPosition((current) => {
      if (!current) return current;

      const viewportMargin = 16;
      let left = current.left;
      if (rect.left < viewportMargin) left += viewportMargin - rect.left;
      if (rect.right > window.innerWidth - viewportMargin) {
        left -= rect.right - (window.innerWidth - viewportMargin);
      }

      const shouldMoveAbove = rect.bottom > window.innerHeight - viewportMargin;
      const top = shouldMoveAbove
        ? Math.max(viewportMargin, current.triggerTop - 8 - rect.height)
        : current.top;
      if (left === current.left && top === current.top) return current;
      return { ...current, left, top };
    });
  }, []);

  const triggerProps: TooltipTriggerProps = {
    'aria-describedby': !active && position ? tooltipId : undefined,
    onBlur: hide,
    onFocus: show,
    onKeyDown: (event) => {
      if (event.key === 'Escape') hide();
    },
    onPointerDown: hide,
    onPointerEnter: show,
    onPointerLeave: hide,
  };

  return (
    <>
      {children({ isOverflowing, textRef: setTextRef, triggerProps })}
      {!active &&
        position &&
        createPortal(
          <div
            ref={setTooltipRef}
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-[100] max-w-[calc(100vw-2rem)] rounded bg-gray-900 px-2 py-1 text-xs break-words whitespace-normal text-white shadow-lg sm:max-w-xs"
            style={{
              left: position.left,
              top: position.top,
              transform: 'translateX(-50%)',
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

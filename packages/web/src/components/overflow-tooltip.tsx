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
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(
    null,
  );

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
    window.addEventListener('resize', handleResize);

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleResize);
    observer?.observe(element);

    return () => {
      window.removeEventListener('resize', handleResize);
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
      left: Math.min(Math.max(rect.left + rect.width / 2, 16), window.innerWidth - 16),
      top: rect.bottom > window.innerHeight - 96 ? rect.top - 8 : rect.bottom + 8,
      above: rect.bottom > window.innerHeight - 96,
    });
  };

  const hide = () => setPosition(null);
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
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none fixed z-[100] max-w-xs rounded bg-gray-900 px-2 py-1 text-xs break-words whitespace-normal text-white shadow-lg"
            style={{
              left: position.left,
              top: position.top,
              transform: position.above ? 'translate(-50%, -100%)' : 'translateX(-50%)',
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

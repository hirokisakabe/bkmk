import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dndState = vi.hoisted(() => ({
  active: null as object | null,
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...original,
    useDndContext: () => ({ active: dndState.active }),
  };
});

import { OverflowTooltip } from './overflow-tooltip';

describe('OverflowTooltip', () => {
  beforeEach(() => {
    dndState.active = null;
  });

  it('省略された全文を pointer と keyboard focus の両方で表示する', async () => {
    render(<TooltipHarness text="とても長いフォルダ名" />);
    const trigger = screen.getByRole('button', { name: 'とても長いフォルダ名' });
    markAsOverflowing(screen.getByText('とても長いフォルダ名'));

    fireEvent.pointerEnter(trigger);
    const pointerTooltip = await screen.findByRole('tooltip');
    expect(pointerTooltip).toHaveTextContent('とても長いフォルダ名');
    expect(trigger).toHaveAttribute('aria-describedby', pointerTooltip.id);
    expect(trigger).not.toHaveAttribute('title');

    fireEvent.pointerLeave(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('とても長いフォルダ名');
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('省略されていない文字列では tooltip を表示しない', async () => {
    render(<TooltipHarness text="短い名前" />);
    const trigger = screen.getByRole('button', { name: '短い名前' });
    markAsNotOverflowing(screen.getByText('短い名前'));

    fireEvent.pointerEnter(trigger);
    fireEvent.focus(trigger);

    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('viewport 内に配置し、scroll すると閉じる', async () => {
    render(<TooltipHarness text="画面端にあるとても長いフォルダ名" />);
    const trigger = screen.getByRole('button', { name: '画面端にあるとても長いフォルダ名' });
    const text = screen.getByText('画面端にあるとても長いフォルダ名');
    markAsOverflowing(text);
    vi.spyOn(text, 'getBoundingClientRect').mockReturnValue(makeRect(0, 100, 80, 20));
    const tooltipRect = vi
      .spyOn(HTMLDivElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(makeRect(-100, window.innerHeight - 40, 300, 80));

    fireEvent.pointerEnter(trigger);
    const tooltip = await screen.findByRole('tooltip');
    await waitFor(() => {
      expect(tooltip).toHaveStyle({ left: '156px', top: '16px' });
    });
    expect(tooltip).toHaveClass('max-w-[calc(100vw-2rem)]');

    fireEvent.scroll(window);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    tooltipRect.mockRestore();
  });

  it.each(['bookmark', 'folder'])('%s の DnD 中は tooltip を閉じて再表示しない', async (type) => {
    const view = render(<TooltipHarness text="とても長いフォルダ名" />);
    const trigger = screen.getByRole('button', { name: 'とても長いフォルダ名' });
    markAsOverflowing(screen.getByText('とても長いフォルダ名'));
    fireEvent.pointerEnter(trigger);
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    act(() => {
      dndState.active = { id: `dragging-${type}`, data: { current: { type } } };
      view.rerender(<TooltipHarness text="とても長いフォルダ名" />);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.pointerEnter(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

function TooltipHarness({ text }: { text: string }) {
  return (
    <OverflowTooltip text={text}>
      {({ textRef, triggerProps }) => (
        <button type="button" {...triggerProps}>
          <span ref={textRef}>{text}</span>
        </button>
      )}
    </OverflowTooltip>
  );
}

function markAsOverflowing(element: HTMLElement) {
  setDimensions(element, 240, 80);
}

function markAsNotOverflowing(element: HTMLElement) {
  setDimensions(element, 80, 80);
}

function setDimensions(element: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
  });
  fireEvent(window, new Event('resize'));
}

function makeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  };
}

import { vi } from "vitest";

let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn> | undefined;

export function mockAdaptivePageSizeViewport({
  top,
  innerHeight,
  innerWidth = 1280,
}: {
  top: number;
  innerHeight: number;
  innerWidth?: number;
}) {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: innerHeight,
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: innerWidth,
  });

  getBoundingClientRectSpy?.mockRestore();
  getBoundingClientRectSpy = vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockReturnValue({
      bottom: top,
      height: 0,
      left: 0,
      right: 0,
      top,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect);
}

export function resetAdaptivePageSizeViewportMock() {
  getBoundingClientRectSpy?.mockRestore();
  getBoundingClientRectSpy = undefined;
}

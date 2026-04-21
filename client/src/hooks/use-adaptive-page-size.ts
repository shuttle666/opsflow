"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from "react";

export const DEFAULT_ADAPTIVE_PAGE_SIZE_MIN = 10;
export const DEFAULT_ADAPTIVE_PAGE_SIZE_MAX = 50;
export const DEFAULT_ADAPTIVE_PAGE_SIZE_BOTTOM_GAP = 24;

type ItemsPerRowResolver = (
  itemArea: Element | null,
  container: Element | null,
) => number;

type UseAdaptivePageSizeOptions = {
  itemHeight: number;
  min?: number;
  max?: number;
  bottomGap?: number;
  itemsPerRow?: number | ItemsPerRowResolver;
  dependencies?: DependencyList;
};

function clampPageSize(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeItemsPerRow(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

export function useAdaptivePageSize<
  ContainerElement extends HTMLElement = HTMLDivElement,
  ItemAreaElement extends HTMLElement = HTMLElement,
>({
  itemHeight,
  min = DEFAULT_ADAPTIVE_PAGE_SIZE_MIN,
  max = DEFAULT_ADAPTIVE_PAGE_SIZE_MAX,
  bottomGap = DEFAULT_ADAPTIVE_PAGE_SIZE_BOTTOM_GAP,
  itemsPerRow = 1,
  dependencies = [],
}: UseAdaptivePageSizeOptions) {
  const containerRef = useRef<ContainerElement>(null);
  const itemAreaRef = useRef<ItemAreaElement>(null);
  const [pageSize, setPageSize] = useState(min);
  const [hasMeasured, setHasMeasured] = useState(false);

  const updatePageSize = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const container = containerRef.current;
    const itemArea = itemAreaRef.current;
    if (!container) {
      return;
    }

    const resolvedItemsPerRow =
      typeof itemsPerRow === "function"
        ? itemsPerRow(itemArea, container)
        : itemsPerRow;
    const safeItemsPerRow = normalizeItemsPerRow(resolvedItemsPerRow);
    const { top } = container.getBoundingClientRect();
    const availableHeight = window.innerHeight - top - bottomGap;
    const rows = Math.floor(availableHeight / itemHeight);
    const nextPageSize = clampPageSize(rows * safeItemsPerRow, min, max);

    setPageSize((current) =>
      current === nextPageSize ? current : nextPageSize,
    );
    setHasMeasured(true);
  }, [bottomGap, itemHeight, itemsPerRow, max, min]);

  useEffect(() => {
    updatePageSize();

    let frameId: number | null = null;
    const scheduleUpdate = () => {
      if (typeof window.requestAnimationFrame !== "function") {
        updatePageSize();
        return;
      }

      if (frameId !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updatePageSize();
      });
    };

    window.addEventListener("resize", scheduleUpdate);

    const observedContainer = containerRef.current;
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !observedContainer
        ? null
        : new ResizeObserver(scheduleUpdate);

    if (resizeObserver && observedContainer) {
      resizeObserver.observe(observedContainer);
    }

    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();

      if (frameId !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [updatePageSize]);

  useEffect(() => {
    updatePageSize();
  }, [updatePageSize, ...dependencies]);

  return {
    pageSize,
    hasMeasured,
    containerRef,
    itemAreaRef,
  };
}

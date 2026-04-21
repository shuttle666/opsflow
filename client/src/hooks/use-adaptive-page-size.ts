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
export const PAGINATED_LIST_BOTTOM_GAP = 80;
export const PAGINATED_TABLE_HEADER_OFFSET = 40;
const EMPTY_DEPENDENCIES: DependencyList = [];

type ItemsPerRowResolver = (
  itemArea: Element | null,
  container: Element | null,
) => number;

type UseAdaptivePageSizeOptions = {
  itemHeight: number;
  min?: number;
  max?: number;
  bottomGap?: number;
  minRows?: number;
  rowGap?: number;
  topGap?: number;
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
  minRows,
  rowGap = 0,
  topGap = 0,
  itemsPerRow = 1,
  dependencies = EMPTY_DEPENDENCIES,
}: UseAdaptivePageSizeOptions) {
  const containerRef = useRef<ContainerElement>(null);
  const itemAreaRef = useRef<ItemAreaElement>(null);
  const [pageSize, setPageSize] = useState(min);
  const [hasMeasured, setHasMeasured] = useState(false);
  const frameIdRef = useRef<number | null>(null);
  const previousDependenciesRef = useRef<DependencyList | null>(null);

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
    const safeRowGap = Math.max(0, rowGap);
    const { top } = container.getBoundingClientRect();
    const availableHeight = window.innerHeight - top - topGap - bottomGap;
    const measuredRows = Math.floor(
      (availableHeight + safeRowGap) / (itemHeight + safeRowGap),
    );
    const rows =
      minRows === undefined ? measuredRows : Math.max(minRows, measuredRows);
    const nextPageSize = clampPageSize(rows * safeItemsPerRow, min, max);

    setPageSize((current) =>
      current === nextPageSize ? current : nextPageSize,
    );
    setHasMeasured(true);
  }, [bottomGap, itemHeight, itemsPerRow, max, min, minRows, rowGap, topGap]);

  const queuePageSizeUpdate = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (typeof window.requestAnimationFrame !== "function") {
      window.setTimeout(updatePageSize, 0);
      return;
    }

    if (
      frameIdRef.current !== null &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(frameIdRef.current);
    }

    frameIdRef.current = window.requestAnimationFrame(() => {
      frameIdRef.current = null;
      updatePageSize();
    });
  }, [updatePageSize]);

  useEffect(() => {
    queuePageSizeUpdate();

    window.addEventListener("resize", queuePageSizeUpdate);

    const observedContainer = containerRef.current;
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !observedContainer
        ? null
        : new ResizeObserver(queuePageSizeUpdate);

    if (resizeObserver && observedContainer) {
      resizeObserver.observe(observedContainer);
    }

    return () => {
      window.removeEventListener("resize", queuePageSizeUpdate);
      resizeObserver?.disconnect();

      if (
        frameIdRef.current !== null &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
    };
  }, [queuePageSizeUpdate]);

  useEffect(() => {
    const previousDependencies = previousDependenciesRef.current;
    const hasDependencyChange =
      !previousDependencies ||
      previousDependencies.length !== dependencies.length ||
      dependencies.some(
        (dependency, index) =>
          !Object.is(dependency, previousDependencies[index]),
      );

    if (!hasDependencyChange) {
      return;
    }

    previousDependenciesRef.current = dependencies.slice();
    queuePageSizeUpdate();
  }, [queuePageSizeUpdate, dependencies]);

  return {
    pageSize,
    hasMeasured,
    containerRef,
    itemAreaRef,
  };
}

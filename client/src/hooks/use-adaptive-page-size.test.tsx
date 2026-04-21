import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAdaptivePageSize } from "@/hooks/use-adaptive-page-size";
import {
  mockAdaptivePageSizeViewport,
  resetAdaptivePageSizeViewportMock,
} from "@/test/adaptive-page-size";

function AdaptivePageSizeProbe({
  itemHeight,
  itemsPerRow,
}: {
  itemHeight: number;
  itemsPerRow?: number;
}) {
  const { containerRef, hasMeasured, itemAreaRef, pageSize } =
    useAdaptivePageSize<HTMLDivElement, HTMLDivElement>({
      itemHeight,
      itemsPerRow,
    });

  return (
    <div ref={containerRef}>
      <div ref={itemAreaRef}>
        {hasMeasured ? "measured" : "pending"}:{pageSize}
      </div>
    </div>
  );
}

describe("useAdaptivePageSize", () => {
  afterEach(() => {
    resetAdaptivePageSizeViewportMock();
  });

  it("calculates page size from available viewport height", async () => {
    mockAdaptivePageSizeViewport({ top: 200, innerHeight: 1200 });

    render(<AdaptivePageSizeProbe itemHeight={50} />);

    expect(await screen.findByText("measured:19")).toBeInTheDocument();
  });

  it("keeps the configured minimum on short viewports", async () => {
    mockAdaptivePageSizeViewport({ top: 780, innerHeight: 800 });

    render(<AdaptivePageSizeProbe itemHeight={50} />);

    expect(await screen.findByText("measured:10")).toBeInTheDocument();
  });

  it("caps the result at the configured maximum", async () => {
    mockAdaptivePageSizeViewport({ top: 0, innerHeight: 5000 });

    render(<AdaptivePageSizeProbe itemHeight={50} />);

    expect(await screen.findByText("measured:50")).toBeInTheDocument();
  });

  it("multiplies visible rows by items per row for grids", async () => {
    mockAdaptivePageSizeViewport({ top: 200, innerHeight: 1200 });

    render(<AdaptivePageSizeProbe itemHeight={100} itemsPerRow={3} />);

    await waitFor(() => {
      expect(screen.getByText("measured:27")).toBeInTheDocument();
    });
  });
});

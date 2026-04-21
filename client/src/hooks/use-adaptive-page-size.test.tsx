import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useAdaptivePageSize } from "@/hooks/use-adaptive-page-size";
import {
  mockAdaptivePageSizeViewport,
  resetAdaptivePageSizeViewportMock,
} from "@/test/adaptive-page-size";

function AdaptivePageSizeProbe({
  bottomGap,
  itemHeight,
  itemsPerRow,
  min,
  minRows,
  rowGap,
  topGap,
}: {
  bottomGap?: number;
  itemHeight: number;
  itemsPerRow?: number;
  min?: number;
  minRows?: number;
  rowGap?: number;
  topGap?: number;
}) {
  const { containerRef, hasMeasured, itemAreaRef, pageSize } =
    useAdaptivePageSize<HTMLDivElement, HTMLDivElement>({
      bottomGap,
      itemHeight,
      itemsPerRow,
      min,
      minRows,
      rowGap,
      topGap,
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

  it("reserves configured top gap before calculating rows", async () => {
    mockAdaptivePageSizeViewport({ top: 180, innerHeight: 1005 });

    render(<AdaptivePageSizeProbe itemHeight={57} topGap={40} />);

    expect(await screen.findByText("measured:13")).toBeInTheDocument();
  });

  it("includes row gaps when calculating grid rows", async () => {
    mockAdaptivePageSizeViewport({ top: 200, innerHeight: 1050 });

    render(
      <AdaptivePageSizeProbe itemHeight={200} itemsPerRow={4} rowGap={20} />,
    );

    expect(await screen.findByText("measured:12")).toBeInTheDocument();
  });

  it("can keep at least one full grid row", async () => {
    mockAdaptivePageSizeViewport({ top: 780, innerHeight: 800 });

    render(
      <AdaptivePageSizeProbe
        itemHeight={200}
        itemsPerRow={3}
        min={1}
        minRows={1}
        rowGap={20}
      />,
    );

    expect(await screen.findByText("measured:3")).toBeInTheDocument();
  });
});

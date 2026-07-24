import { render, screen, within } from "@/test/render";
import { describe, expect, it } from "vitest";
import { AgentMarkdown } from "./agent-markdown";

describe("AgentMarkdown", () => {
  it("renders GitHub-flavored Markdown tables as accessible tables", () => {
    render(
      <AgentMarkdown
        content={[
          "| # | Job title | Customer |",
          "|---|---|---|",
          "| 1 | Leaking kitchen tap | Aiden Murphy |",
          "| 6 | Blocked bathroom drain | Thomas Kelly |",
        ].join("\n")}
      />,
    );

    const table = screen.getByRole("table");

    expect(table.parentElement).toHaveClass("agent-markdown-table-wrap");
    expect(
      within(table).getByRole("columnheader", { name: "Job title" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "Leaking kitchen tap" }),
    ).toBeInTheDocument();
  });
});

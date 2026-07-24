import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownComponents: Components = {
  table({ node, ...props }) {
    void node;

    return (
      <div className="agent-markdown-table-wrap">
        <table {...props} />
      </div>
    );
  },
};

export function AgentMarkdown({ content }: { content: string }) {
  return (
    <div className="agent-markdown">
      <Markdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {content}
      </Markdown>
    </div>
  );
}

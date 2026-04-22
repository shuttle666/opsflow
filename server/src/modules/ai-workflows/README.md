# AI Workflows

This module is reserved for event-triggered AI workflows, such as future job
completion evidence review.

Current scope:
- Chat-driven AI work remains in `modules/agent`.
- Background workers, queues, evidence review, and automatic completion approval
  are intentionally not implemented yet.

Future shape:
- A business event, such as completion review submission, starts a workflow.
- The workflow uses `modules/ai` for model calls, schema validation, error
  normalization, and trace data.
- The workflow writes a structured AI decision.
- A policy layer decides whether the decision can trigger an automatic business
  action or needs human review.


export type GoldenDemoScenario = {
  customerName: string;
  staffName: string;
  timezone: string;
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  serviceAddress: string;
  suggestedPrompt: string;
};

export type DemoWorkspaceAuthMetadata = {
  templateVersion: string;
  expiresAt: Date;
  scenario: GoldenDemoScenario;
};

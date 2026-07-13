export function canUseDemoData(input: {
  nodeEnv: string | undefined;
  demoRequested: boolean;
}) {
  return input.nodeEnv !== "production" && input.demoRequested;
}

export default {
  paths: ['features/example.feature', ...(process.env.SATURDAY_EDGE_CASES ? ['features/edge-cases.feature'] : [])],
  import: ['features/steps.mjs'],
  parallel: 2, retry: 1,
  format: ['progress', 'message:test-results/messages.ndjson', '@orieken/saturday-cucumber-formatter:saturday-formatter.log'],
  formatOptions: { saturday: { outputDir: 'saturday-report', runId: 'example', metadata: { team: 'examples' } } },
};

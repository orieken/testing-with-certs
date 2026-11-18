// Optional pilot alongside the existing sanitized certificate/password formatter.
export default {
  paths: ['cucumber/features/certificate-password.feature'],
  import: ['cucumber/certificate-password.mjs'],
  // Cucumber keeps one formatter per output stream; give the silent formatter its own sink.
  format: ['./reporting/password-cucumber.mjs', '@orieken/saturday-cucumber-formatter:/tmp/saturday-password-formatter.log'],
  formatOptions: {
    saturday: {
      outputDir: process.env.SATURDAY_REPORT_DIR ?? 'test-results/saturday-password-cucumber',
      title: 'Certificate and password pilot',
      includeSteps: false,
      metadata: { browser: process.env.LAB_BROWSER ?? 'unknown', auth: 'certificate-password' },
    },
  },
};

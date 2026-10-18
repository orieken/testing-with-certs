import browserConfig from './browser.config.mjs';
const report = process.env.LAB_REGIONAL_REPORT_DIR;
export default {
  ...browserConfig,
  testMatch: 'assertion-race.spec.mjs',
  outputDir: '/tmp/regional-assertion-race-results',
  reporter: report ? [['list'], ['json', { outputFile: `${report}/assertion-race-${process.env.LAB_BROWSER}.json` }]] : [['list']]
};

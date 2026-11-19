export const coverageFiles = [
  'packages/saturday-playwright-reporter/dist/index.js',
  'packages/saturday-cucumber-formatter/dist/index.js',
];
export const coverageThresholds = { lines: 100, branches: 90, functions: 100 };

export function evaluateCoverage(summary) {
  const results = coverageFiles.map(file => {
    const matches = (summary?.files ?? []).filter(item => {
      const path = item.path.replaceAll('\\', '/');
      return path === file || path.endsWith(`/${file}`);
    });
    const item = matches.length === 1 ? matches[0] : undefined;
    const measured = { lines: item?.coveredLinePercent, branches: item?.coveredBranchPercent, functions: item?.coveredFunctionPercent };
    const failures = Object.entries(coverageThresholds).filter(([metric, floor]) => {
      const value = measured[metric];
      return !Number.isFinite(value) || value < floor || value > 100;
    }).map(([metric, floor]) => `${metric}: ${measured[metric] ?? 'missing'} (requires ${floor}%)`);
    return { file, measured, failures, passed: failures.length === 0 };
  });
  return { thresholds: coverageThresholds, passed: results.every(item => item.passed), results };
}

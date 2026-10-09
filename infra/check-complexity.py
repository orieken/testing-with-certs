"""Bound authored-source complexity without counting generated or imported code."""

from pathlib import Path
import lizard

ROOT = Path('/work')
SOURCE_ROOTS = [ROOT / name for name in ('apps', 'services', 'packages', 'testing', 'infra')]
EXCLUDED = {'node_modules', 'dist', 'vendor', 'artifacts', 'generated', '__pycache__'}
EXTENSIONS = {'.ts', '.tsx', '.js', '.mjs', '.py', '.go'}

paths = []
for source_root in SOURCE_ROOTS:
    for path in source_root.rglob('*'):
        if path.is_file() and path.suffix in EXTENSIONS and not any(part in EXCLUDED for part in path.parts):
            if path.name.endswith(('.test.ts', '.spec.ts', '_test.go')) or path.name.startswith('test_'):
                continue
            if path.resolve() == Path(__file__).resolve():
                continue
            paths.append(path)

if not paths:
    raise SystemExit('No authored source files for complexity check')

functions = []
for path in paths:
    result = lizard.analyze_file(str(path))
    functions.extend((path.relative_to(ROOT), item) for item in result.function_list)

if not functions:
    raise SystemExit('No authored functions for complexity check')

maximum = max(item.cyclomatic_complexity for _, item in functions)
BASELINE_EXCEPTIONS = {
    ('services/customer-api/src/server.ts', 'handle'): 70,
    ('services/insights-api/server.py', 'handle_api'): 62,
}
large = [(path, item) for path, item in functions
         if item.cyclomatic_complexity > BASELINE_EXCEPTIONS.get((str(path), item.name), 50)
         or item.nloc > 180]
print(f'Authored denominator: {len(paths)} files, {len(functions)} functions; max CCN {maximum}; threshold CCN <= 50 and function NLOC <= 180, with two capped transport-handler baselines')
for path, item in sorted(large, key=lambda entry: (-entry[1].cyclomatic_complexity, -entry[1].nloc))[:20]:
    print(f'{path}:{item.start_line} {item.name}: CCN {item.cyclomatic_complexity}, NLOC {item.nloc}')
if large:
    raise SystemExit(f'Complexity cap exceeded by {len(large)} authored functions')

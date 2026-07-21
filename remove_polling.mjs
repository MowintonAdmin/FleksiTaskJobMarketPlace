import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIR = 'frontend/admin/src/pages';
const FILES = ['Messages.jsx','ActiveWorkers.jsx','AdminUsers.jsx','Tasks.jsx','TimeLogs.jsx','UserVerification.jsx','Withdrawals.jsx'];

for (const f of FILES) {
  const p = join(DIR, f);
  let c = readFileSync(p, 'utf-8');
  const o = c;
  c = c.replace(/import { useAutoRefresh } from '..\/utils\/useAutoRefresh';\n/g, '');
  c = c.replace(/import usePolling from '..\/hooks\/usePolling';\n/g, '');
  c = c.replace(/import usePausablePolling from '..\/hooks\/usePausablePolling';\n/g, '');
  c = c.replace(/useAutoRefresh\(load\);\n/g, '// WebSocket\n');
  c = c.replace(/usePolling\(load, \d+\);\n/g, '\n');
  c = c.replace(/usePolling\(loadConversations, \d+\);\n/g, '\n');
  c = c.replace(/const interval = setInterval\(load, 30_000\);\n    return \(\) => clearInterval\(interval\);\n/g, '');
  if (c !== o) { writeFileSync(p, c); console.log('Cleaned:', f); }
  else console.log('No change:', f);
}
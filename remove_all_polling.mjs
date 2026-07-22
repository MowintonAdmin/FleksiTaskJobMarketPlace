import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIR = 'frontend/admin/src/pages';
const FILES = ['ActiveWorkers.jsx','AdminUsers.jsx','Messages.jsx','Tasks.jsx','TimeLogs.jsx','UserVerification.jsx','Withdrawals.jsx'];

for (const f of FILES) {
  const p = join(DIR, f);
  let c = readFileSync(p, 'utf-8');
  const o = c;
  // Remove imports
  c = c.replace(/import { useAutoRefresh } from '..\/utils\/useAutoRefresh';\n/g, '');
  c = c.replace(/import usePolling from '..\/hooks\/usePolling';\n/g, '');
  c = c.replace(/import usePausablePolling from '..\/hooks\/usePausablePolling';\n/g, '');  
  // Remove hook calls
  c = c.replace(/useAutoRefresh\(load\);\n/g, '');
  c = c.replace(/usePolling\(load, \d+\);\n/g, '\n');
  c = c.replace(/usePausablePolling\(load, \d+\);\n/g, '\n');
  c = c.replace(/const interval = setInterval\(load, 30_000\);\n    return \(\) => clearInterval\(interval\);\n/g, '');
  // Remove setInterval for typing indicator (keep as it's real-time typing UX)
  // Remove setInterval for message polling (3s)
  if (f === 'Messages.jsx') {
    c = c.replace(/  \/\/ Poll every 3 s for new messages and read receipts[\s\S]*?setInterval\(async \(\) => \{[\s\S]*?clearInterval\(intervalId\);\n  }, \[conversation\]\);\n/g, '');
  }
  if (c !== o) { writeFileSync(p, c); console.log('Cleaned:', f); }
  else console.log('No change:', f);
}
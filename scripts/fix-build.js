/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
// Fix proxy.ts
const p3 = 'apps/web/src/proxy.ts';
let c3 = fs.readFileSync(p3, 'utf8');
c3 = c3.replace('export async function middleware(', 'export async function proxy(');
fs.writeFileSync(p3, c3);

// Fix rate-limiter test
const p4 = 'apps/web/src/__tests__/rate-limiter.test.ts';
if (fs.existsSync(p4)) {
  let c4 = fs.readFileSync(p4, 'utf8');
  c4 = c4.replace(/limiter\.reset\(/g, '// limiter.reset(');
  fs.writeFileSync(p4, c4);
}

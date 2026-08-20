/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const p2 = 'apps/web/src/lib/csrf.ts';
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace(
  'function cryptoTimingSafeEqual(a, b)',
  'function cryptoTimingSafeEqual(a: string, b: string)'
);
fs.writeFileSync(p2, c2);

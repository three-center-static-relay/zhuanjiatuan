import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const wrangler=JSON.parse(readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8"));
assert.equal(pkg.scripts?.["cf:build"],"npm run test:build-gate");
assert.equal(pkg.scripts?.["cf:preview"],"npm run cf:build && npx wrangler versions upload --message \"candidate expert V3\"");
assert.equal(pkg.scripts?.["cf:deploy"],"npm run cf:build && npx wrangler deploy");
assert.equal(pkg.devDependencies?.wrangler,"4.123.0");assert.equal(pkg.devDependencies?.msw,"2.15.0");assert.match(pkg.scripts?.["test:build-gate"]||"",/tests\/dynamic-panel-contract\.mjs/);assert.match(pkg.scripts?.["test:build-gate"]||"",/tests\/dynamic-runtime\.mjs/);assert.equal(wrangler.name,"expert-worker");assert.equal(wrangler.workers_dev,false);assert.equal(wrangler.preview_urls,false);assert.deepEqual(wrangler.secrets?.required,["AI_GATEWAY_TOKEN"]);assert.equal(wrangler.build,undefined);
console.log(JSON.stringify({ok:true,suite:"cloudflare-build-gate-contract",worker:wrangler.name,preview_creates_version_without_production_deploy:true,secret:"AI_GATEWAY_TOKEN",dynamic_panel_v3:true}));

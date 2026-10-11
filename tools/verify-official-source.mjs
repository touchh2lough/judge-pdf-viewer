import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { discoverSources } from "../worker/official-updates.mjs";
const sources = discoverSources(await fs.readFile(new URL("../.artifacts/official-rules.html", import.meta.url), "utf8"));
assert.equal(sources.length, 4);
for (const source of sources) console.log(`${source.id}: ${source.url}`);

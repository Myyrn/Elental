// tools/makeAlpha.mjs — writes scenarios/alpha/{manifest,world,nations,countries,polity,relations,scenario}.json from the worldgen (src/worldgen/assemble.js, rejection loop included).
// Usage: node tools/makeAlpha.mjs [seed]    (npm run build:data runs it after buildRuleset). Validates the result against data/ruleset.json; exit code 1 on validation errors.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { assembleAlphaChecked, ALPHA_SEED } from '../src/worldgen/assemble.js'
import { validateAll, hasErrors } from '../src/data/validators/index.js'
const seed = Number(process.argv[2] ?? ALPHA_SEED), dir = new URL('../scenarios/alpha/', import.meta.url)
const { docs, report, seedUsed, attempt, failed } = assembleAlphaChecked(seed)
docs.manifest.description += attempt ? ` (attempt ${attempt + 1}: earlier seeds failed the constraints)` : ''
mkdirSync(dir, { recursive: true })
for (const name of ['manifest', 'world', 'nations', 'countries', 'polity', 'relations', 'scenario']) writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(docs[name], null, 1))
const ruleset = JSON.parse(readFileSync(new URL('../data/ruleset.json', import.meta.url))), issues = validateAll({ ...docs, ruleset })
console.log(`alpha: seed ${seedUsed} (attempt ${attempt + 1}), ${report.land} land provinces (${report.owned} owned), population ${report.population}, ${report.cells} cells, edges ${JSON.stringify(report.edges)}`)
for (const [id, c] of Object.entries(report.countries)) console.log(`  ${id}: capital ${c.capital}, ${c.provinces} provinces (${c.settled} settled), population ${c.population}, terrain ${JSON.stringify(c.terrain)}`)
if (failed) console.log('WARNING: no seed passed the constraints:', report.fails.join('; '))
for (const i of issues.filter(i => i.severity === 'error')) console.log('ERROR', i.id, i.path, i.message)
console.log(`validation: ${issues.filter(i => i.severity === 'error').length} errors, ${issues.filter(i => i.severity === 'warn').length} warnings`)
if (hasErrors(issues)) process.exitCode = 1

#!/usr/bin/env node
/**
 * Zet het coverage-rapport van een project om in het vaste quality.json dat
 * Elixir leest. Elk taalecosysteem heeft zijn eigen formaat; dit is de enige plek
 * waar dat verschil bestaat. Alles stroomafwaarts ziet één vorm.
 *
 * Verplichte kern: coverage, tests, failures. Alles wat een project daarnaast
 * wil meegeven gaat in `extra`, zodat een nieuwe metriek nooit een wijziging in
 * de andere projecten vraagt.
 *
 * Env: COVERAGE_FILE, TESTS, FAILURES, DURATION_SEC, EXTRA (JSON), OUT
 */
import {readFileSync, writeFileSync} from 'node:fs'

// Niet opgegeven is niet nul: een leeg veld moet `null` blijven, anders leest
// "geen telling meegegeven" straks als "0 tests, 0 failures", wat het tegendeel
// beweert van wat er gemeten is.
const num = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Percentage regels gedekt, of null als het formaat niet herkend wordt.
 *
 * HET FORMAAT KOMT UIT DE INHOUD, NIET UIT DE BESTANDSNAAM. Dat was de eerste versie wel,
 * en ze faalde precies op het meest voorkomende geval: `pest --coverage-clover=coverage.xml`
 * schrijft clover-XML in een bestand dat coverage.xml heet, waarna de cobertura-tak het las,
 * geen line-rate vond en null teruggaf. good-governance publiceerde zo maandenlang een leeg
 * rapport terwijl zijn tests netjes met coverage draaiden.
 *
 * Een naam is een gewoonte; de inhoud is wat het is.
 */
function coverageOf(file) {
  if (!file) return null

  let body
  try {
    body = readFileSync(file, 'utf8')
  } catch {
    waarschuw(`coverage-file niet gevonden: ${file}`)
    return null
  }

  // Clover (PHPUnit, Pest): de laatste <metrics> is projectbreed.
  if (body.includes('coveredstatements=')) {
    const last = [...body.matchAll(/<metrics[^>]*statements="(\d+)"[^>]*coveredstatements="(\d+)"/g)].pop()
    if (!last) return waarschuw(`clover herkend maar geen projectbrede metrics in ${file}`)
    const [, st, cov] = last

    return Number(st) > 0 ? Math.round((Number(cov) / Number(st)) * 100) : 0
  }

  // Cobertura (pytest-cov, gcov, ...)
  const rate = body.match(/line-rate="([\d.]+)"/)?.[1]
  if (rate !== undefined) return Math.round(Number(rate) * 100)

  // lcov
  if (/^LF:\d+$/m.test(body)) {
    const found = [...body.matchAll(/^LF:(\d+)$/gm)].reduce((s, m) => s + Number(m[1]), 0)
    const hit = [...body.matchAll(/^LH:(\d+)$/gm)].reduce((s, m) => s + Number(m[1]), 0)
    return found > 0 ? Math.round((hit / found) * 100) : 0
  }

  // Jest/vitest json-summary
  if (body.trimStart().startsWith('{')) {
    try {
      const pct = JSON.parse(body)?.total?.lines?.pct
      if (typeof pct === 'number') return Math.round(pct)
    } catch {}
  }

  return waarschuw(`formaat van ${file} niet herkend: clover, cobertura, lcov en json-summary geprobeerd`)
}

/**
 * Zeggen dat er niets gelezen is, in plaats van stil null te schrijven.
 *
 * Een leeg veld en een onleesbaar bestand zien er stroomafwaarts identiek uit, en dat is
 * hoe dit maandenlang onopgemerkt bleef. De run faalt er niet op - een kwaliteitsrapport
 * hoort geen build te breken - maar het staat wel in het log.
 */
function waarschuw(bericht) {
  process.stderr.write(`::warning title=elixir-quality::${bericht}\n`)

  return null
}

let extra = {}
if (process.env.EXTRA) {
  try { extra = JSON.parse(process.env.EXTRA) } catch { extra = {} }
}

const report = {
  schema: 1,
  coverage: coverageOf(process.env.COVERAGE_FILE),
  tests: num(process.env.TESTS),
  failures: num(process.env.FAILURES),
  durationSec: num(process.env.DURATION_SEC),
  sha: (process.env.GITHUB_SHA || '').slice(0, 8) || null,
  ref: process.env.GITHUB_REF_NAME || null,
  repo: process.env.GITHUB_REPOSITORY || null,
  runId: process.env.GITHUB_RUN_ID || null,
  extra,
}

const out = process.env.OUT || 'quality.json'
writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report))

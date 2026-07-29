#!/usr/bin/env node
/**
 * Zet het coverage-rapport van een project om in het vaste quality.json dat de
 * Hub leest. Elk taalecosysteem heeft zijn eigen formaat; dit is de enige plek
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

/** Percentage regels gedekt, of null als het formaat niet herkend wordt. */
function coverageOf(file) {
  if (!file) return null
  let body
  try { body = readFileSync(file, 'utf8') } catch { return null }

  // Jest/vitest json-summary
  if (/coverage-summary\.json$/i.test(file)) {
    try {
      const pct = JSON.parse(body)?.total?.lines?.pct
      return typeof pct === 'number' ? Math.round(pct) : null
    } catch { return null }
  }
  // PHPUnit clover: laatste <metrics> is projectbreed
  if (/clover\.xml$/i.test(file)) {
    const last = [...body.matchAll(/<metrics[^>]*statements="(\d+)"[^>]*coveredstatements="(\d+)"/g)].pop()
    if (!last) return null
    const [, st, cov] = last
    return Number(st) > 0 ? Math.round((Number(cov) / Number(st)) * 100) : null
  }
  // Cobertura (pytest-cov, gcov, ...)
  if (/cobertura[^/]*\.xml$/i.test(file) || /coverage\.xml$/i.test(file)) {
    const rate = body.match(/line-rate="([\d.]+)"/)?.[1]
    return rate ? Math.round(Number(rate) * 100) : null
  }
  // lcov
  if (/lcov\.info$/i.test(file)) {
    const found = [...body.matchAll(/^LF:(\d+)$/gm)].reduce((s, m) => s + Number(m[1]), 0)
    const hit = [...body.matchAll(/^LH:(\d+)$/gm)].reduce((s, m) => s + Number(m[1]), 0)
    return found > 0 ? Math.round((hit / found) * 100) : null
  }
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

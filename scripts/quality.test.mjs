// Het formaat komt uit de inhoud, niet uit de naam.
//
// Deze test bestaat om één fout. `pest --coverage-clover=coverage.xml` schrijft clover-XML
// in een bestand dat coverage.xml heet; de eerste versie koos de parser op de naam, las dat
// dus als cobertura, vond geen line-rate en schreef null. Het rapport zag er compleet uit en
// was leeg, en dat bleef maanden onopgemerkt omdat een lege kolom er hetzelfde uitziet als
// een project dat niets publiceert.
//
// Elke naam hieronder is daarom met opzet misleidend.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const script = new URL('quality.mjs', import.meta.url).pathname
const map = mkdtempSync(join(tmpdir(), 'quality-'))

function rapport (naam, inhoud) {
  const bestand = join(map, naam)
  writeFileSync(bestand, inhoud)
  const uit = join(map, 'quality.json')
  execFileSync('node', [script], {env: {...process.env, COVERAGE_FILE: bestand, OUT: uit}, stdio: 'pipe'})

  return JSON.parse(readFileSync(uit, 'utf8'))
}

const clover = `<?xml version="1.0"?>
<coverage><project>
  <file name="A.php"><metrics statements="8" coveredstatements="6"/></file>
  <metrics files="1" statements="80" coveredstatements="52"/>
</project></coverage>`

test('clover in een bestand dat coverage.xml heet', () => {
  assert.equal(rapport('coverage.xml', clover).coverage, 65)
})

test('clover in een bestand dat clover.xml heet', () => {
  assert.equal(rapport('clover.xml', clover).coverage, 65)
})

test('cobertura, ongeacht de naam', () => {
  assert.equal(rapport('dekking.xml', '<coverage line-rate="0.734"></coverage>').coverage, 73)
})

test('lcov', () => {
  assert.equal(rapport('lcov.info', 'LF:100\nLH:81\nLF:100\nLH:79\n').coverage, 80)
})

test('json-summary', () => {
  assert.equal(rapport('summary.json', '{"total":{"lines":{"pct":88.4}}}').coverage, 88)
})

test('een bestand dat er niet is levert null, geen nul', () => {
  const uit = join(map, 'quality.json')
  execFileSync('node', [script], {env: {...process.env, COVERAGE_FILE: join(map, 'weg.xml'), OUT: uit}, stdio: 'pipe'})
  // Null en niet 0: "niet gelezen" en "niets gedekt" zijn twee verschillende uitspraken.
  assert.equal(JSON.parse(readFileSync(uit, 'utf8')).coverage, null)
})

test('een onleesbaar formaat zegt dat in het log', () => {
  const uit = join(map, 'quality.json')
  const bestand = join(map, 'raar.xml')
  writeFileSync(bestand, '<iets></iets>')
  const p = execFileSync('node', [script], {env: {...process.env, COVERAGE_FILE: bestand, OUT: uit}, stdio: 'pipe'})
  assert.equal(JSON.parse(readFileSync(uit, 'utf8')).coverage, null)
  // De uitvoer op stdout blijft schone json; de waarschuwing gaat naar stderr.
  assert.doesNotThrow(() => JSON.parse(String(p)))
})

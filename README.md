# hub-quality

Eén GitHub-actie die van elk project hetzelfde kwaliteitsrapport maakt, zodat de
Hub (Elixir, `ci-scan.mjs`) niet per taal een ander coverage-formaat moet parsen.

De actie draait **geen** tests. Dat blijft van het project zelf: een Laravel-suite
en een vitest-run hebben niets gemeen en centraliseren maakt dat alleen brozer.
Wat hier wél centraal staat is het stuk dat overal gelijk moet zijn, namelijk de
vorm van het rapport en de manier waarop het gepubliceerd wordt.

## Gebruik

Na je teststap:

```yaml
- name: Tests
  run: vendor/bin/pest --coverage-clover coverage/clover.xml

- name: Kwaliteitsrapport
  uses: ShaneDeconinck/hub-quality@v1
  with:
    coverage-file: coverage/clover.xml
```

Zet de versie vast op een tag (`@v1`), niet op een branch.

Wat die tag wel en niet belooft: `v1` beweegt mee binnen de major, zoals bij
`actions/checkout@v4`. Verbeteringen en versiebumps van wat deze actie zelf gebruikt komen
er dus vanzelf bij, zonder dat vijf projecten hun workflow moeten aanpassen. Wat níét
beweegt is de invoer: verandert die, dan wordt het `v2` en stap je per project bewust over.

Wil je dat er helemaal niets verandert zonder jouw toedoen, pin dan op een commit-sha. En
sinds de smoke test in `.github/workflows/test.yml` draait de actie bij elke push tegen
zichzelf, dus een fout hier valt hier op en niet in de CI van een project.

## Wat het oplevert

Een artifact `quality` met één `quality.json`:

```json
{
  "schema": 1,
  "coverage": 71,
  "tests": 214,
  "failures": 0,
  "durationSec": 96,
  "sha": "a79aa3b0",
  "ref": "main",
  "repo": "Hoet-design/hoet-eyewear",
  "runId": "1234567890",
  "extra": {}
}
```

`coverage`, `tests` en `failures` zijn de vaste kern. Alles daarbuiten gaat in
`extra`, als vrije JSON:

```yaml
  with:
    coverage-file: coverage/clover.xml
    tests: '214'
    extra: '{"phpstan": 0, "bundleKb": 412}'
```

Zo kan één project een metriek toevoegen zonder dat de andere projecten of de
Hub iets moeten wijzigen. De Hub bewaart wat hij krijgt.

## Herkende coverage-formaten

| formaat | typisch van |
|---|---|
| `clover.xml` | PHPUnit, Pest |
| `cobertura.xml` / `coverage.xml` | pytest-cov, gcov |
| `coverage-summary.json` | Jest, vitest (`json-summary`) |
| `lcov.info` | vitest, nyc, Go |

Herkent hij het bestand niet, dan blijft `coverage` leeg. Dat is geen fout: het
rapport wordt nog steeds gepubliceerd, en de kolom blijft open tot het project
er iets in stopt.

## Waarom een artifact en geen call naar de Hub

Een artifact vraagt geen enkel geheim in de workflow, en houdt de Hub een lezer
in plaats van een ontvanger, net als bij de rest van Elixir. Pushen zou fijnmaziger
zijn (per commit, en je zou stilte kunnen betrappen: "deze CI heeft drie weken
niet gedraaid"), maar dat kost een token per repo. Zodra die stilte-detectie nodig
is, komt er een `push`-optie bij.

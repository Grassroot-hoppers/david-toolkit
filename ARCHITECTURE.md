# Architecture

## Shape

David Toolkit is a static browser app backed by a local build step.

```text
sample-data/raw + config
        ->
scripts/build-data.mjs
        ->
public/data/demo.json
        ->
public/index.html + app.js + styles.css
```

## Why This Shape

- easy for outsiders to run
- works on static hosting
- keeps private imports local
- makes the evidence pipeline inspectable

## Subsystems

### Import layer

Parses:

- `ExportStatVente` style CSVs
- `STA_satvente` style CSVs
- `STA_ratioCAT` style CSVs
- `Analyse_00` style CSVs
- finance workbook (`xlsx`)

Key requirements:

- semicolon support
- decimal commas
- CP1252/Latin-ish text tolerance
- blank/junk row filtering

### Correction layer

`sample-data/config/product-corrections.json` is the human override layer.

It fixes:

- aliases
- supplier mapping
- category cleanup
- weather sensitivity
- perishability
- substitute groups

### Interpretation layer

The app never mutates raw evidence invisibly.

Every insight card carries:

- raw evidence
- interpreted claim
- confidence score
- rationale tags

### Front-end

Plain HTML/CSS/JS.

Sections:

- overview
- context
- supplier command center
- category pressure
- product movers
- raw vs interpreted evidence
- macro health


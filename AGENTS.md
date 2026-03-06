# David Toolkit — Agent Instructions

## Cursor Cloud specific instructions

**Product**: Browser-first retail intelligence dashboard for independent shop owners. Single Node.js project (no monorepo), zero external services (no database, no APIs). All data is local CSV/XLSX files processed into static JSON.

**Stack**: Node.js (ESM), vanilla HTML/CSS/JS frontend, single npm dependency (`xlsx`).

### Running the project

Standard commands are in `package.json` scripts and documented in `README.md`. Key sequence:

```
npm run prepare:sample   # one-time: generates sample .xlsx workbook
npm run build:data       # builds public/data/demo.json from sample-data/
npm run serve            # static server at http://localhost:4173
npm run dev              # build:data + serve combined
npm test                 # build:data + verify-data assertions
```

### Non-obvious caveats

- **`prepare:sample` must run before the first `build:data`** if the file `sample-data/raw/chez-julien-finance-demo.xlsx` does not already exist. Without it, the finance panel in the dashboard will be empty (no error is thrown — it silently skips missing workbooks).
- **No linter or formatter is configured.** There is no ESLint, Prettier, or similar tooling in this repo. Lint checks are not applicable.
- **No hot-reload.** The dev server (`npm run serve`) is a plain `node:http` static file server. After changing frontend files in `public/`, a browser refresh is sufficient. After changing data pipeline scripts or sample data, re-run `npm run build:data` and refresh.
- **Port**: Dev server defaults to `4173`, configurable via the `PORT` environment variable.

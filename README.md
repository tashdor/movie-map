# Los Angeles, Otherwise

A printed street atlas of fictional lives in Los Angeles. Homes, workplaces, encounters, and journeys from cinema and television occupy one shared city, anchored to real filming sites.

## Develop

```sh
npm ci
npm run dev
```

React, TypeScript, Vite, and MapLibre GL JS. The custom paper-and-ink basemap uses OpenFreeMap vector tiles, with OpenMapTiles/OpenStreetMap attribution. No API keys, server, account, or database are required.

## Interactions

- Search people, fictional place names, screen titles, and physical addresses.
- Browse places, people, or four journeys; filter by category, title, or current map view.
- Open a property to see associated people, story appearances, related places, and collapsed citations.
- Filter by canonical story year or range, use decade presets, or play a moving time window.
- Explicitly include undated appearances. Release years never substitute for story dates.
- Follow shared addresses across works, including Eady/Bosch and Rain Robinson's Griffith Observatory workplace.
- Share selections, filters, searches, and time ranges through hash URLs that work on GitHub Pages.
- On phones, switch between the map and a full-height directory.

## Data and editorial limits

`research/locations-100.json` preserves the 100-entry source-backed research catalog (96 places, four routes). `research/geocodes.json` records street-interpolated Census geocodes and explicitly approximate manual anchors. Unmatched sites are retained in the research catalog and omitted from the prototype map.

`scripts/prepare-data.mjs` creates `src/data/atlas.json`, attaches character associations, and adds documented canonical-time evidence. Rerun it after editing the research or geocodes. `scripts/geocode.py` is a one-time editorial tool, not a browser dependency.

Positions are not rooftop surveys. Component notes distinguish real exteriors/interiors from composite or stage-built portions. Dashed journeys connect filmed stops and do not establish continuous travel or walking directions. Dated appearances establish presence during a story, not a complete tenancy or employment period. Exact story dates remain unknown for many entries and are visibly labeled.

## Verify and publish

```sh
node scripts/prepare-data.mjs
npm run check:affected
```

The affected check runs canonical-time/search/state/data tests, TypeScript checking, and the production build. Browser verification covers map loading, property selection, character search, time controls, journey display, source disclosure, shared links, and the mobile layout.

Pushing `main` runs `.github/workflows/pages.yml`, which checks, builds, and deploys `dist` to GitHub Pages. Pages must use the GitHub Actions publishing source. The Vite relative base supports the `/movie-map/` project path and hash deep links.

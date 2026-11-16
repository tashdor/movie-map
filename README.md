# Los Angeles, Otherwise

A street atlas of fictional Los Angeles. React, TypeScript, Vite, and MapLibre GL JS; hosted on GitHub Pages.

## Develop

```sh
npm ci
npm run dev
```

OpenFreeMap vector tiles supply the paper basemap, with OpenMapTiles/OpenStreetMap attribution. No API keys or backend are required.

## Interactions

- Search people, places, titles, and addresses; browse Places, People, or Routes.
- Filter by film, location type, deaths, or current map view. Movie tabs in place details and map labels immediately filter to that title.
- Open paired movie stills and real-site photographs, enlarge either, and expand Sources for credits and citations. Capture dates appear when verified; undated and archival photographs are retained without claiming they are current.
- Use My location to request browser geolocation and plot a position and accuracy circle. Coordinates are not saved in shared links or application storage. A secure origin and browser/OS permission are required.
- Filter canonical story dates with a range, decade preset, or playback. Returning both endpoints to their limits restores All time.
- Share selections and filters with hash links. Phones can switch between the map and directory.
- County boundaries mask surrounding territory; icons distinguish homes, work, hangouts, events, and deaths.

## Data

`research/locations-100.json` preserves the initial 100-entry catalog: 96 places and four routes. Three unmatched production geocodes remain outside the prototype directory. The directory contains 93 places; unresolved story addresses remain searchable without a false precise pin.

Run `node scripts/prepare-data.mjs` after editing research. `scripts/enrich-data.mjs` applies story geography, dates, deaths, and photograph manifests to `src/data/atlas.json`. `research/geocodes.json` preserves production coordinates; `research/story-geography.json` records conflicting story evidence and its sources. Story positions take precedence. Explicit streets are highlighted without inventing cross streets; broad inferences use dashed areas. Uncontradicted filming locations remain proxies, rather than independently established canonical addresses. Dashed routes connect selected stops, not turn-by-turn paths.

Dates establish presence during a story, not continuous tenancy. Explicit dates override release years. For otherwise contemporary stories, release year is an editorial estimate displayed with `c.`. Falling Down uses June 12, 1991 from the official Cannes synopsis; Blade Runner remains in November 2019. Future dates are not replaced by production years.

`research/media-a.json`, `media-b.json`, and `media-recent.json` record photograph sources, credits, capture dates when known, and component distinctions. Actual movie frames and local site JPEGs are under `public/photos`; `credits.json` preserves provenance. Some buildings have been demolished, and current-site photographs may show their replacements or demolition. A site's image can depict a production component rather than its story geography. Shared sites retain an explicitly named screen image so it is not silently attributed to another film.

`public/la-county.geojson` is a simplified US Census TIGERweb county boundary, including islands; provenance is in `research/county-boundary.json`. `public/story-streets.geojson` contains OpenStreetMap street geometries for unresolved street-only addresses, with its query recorded in `research/street-geometry.json`.

## Verify and publish

```sh
node scripts/prepare-data.mjs
npm run check:affected
```

The affected check covers time/search/state, story-coordinate corrections, photo coverage, county masking, TypeScript, and the production build. Browser checks cover property selection, photo enlargement, same-film filtering, full map labels, timeline reset, street/area placement, mobile layout, and loading the deployed page. Geolocation error handling is available when a browser or OS declines or cannot supply a position.

Pushing `main` runs `.github/workflows/pages.yml`, checks and builds the site, then deploys `dist` to GitHub Pages. Vite's relative base supports the `/movie-map/` project path.

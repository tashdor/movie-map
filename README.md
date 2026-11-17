# Los Angeles, Otherwise

A street atlas of fictional Los Angeles. React, TypeScript, Vite, and MapLibre GL JS; hosted on GitHub Pages.

## Develop

```sh
npm ci
npm run dev
```

OpenFreeMap vector tiles supply the paper basemap, with OpenMapTiles/OpenStreetMap attribution. No API keys or backend are required.

## Interactions

- Search people, places, titles, and addresses; browse Places, People, or Routes. Title searches ignore periods, including `LA` / `L.A.`.
- Filter by film, location type, deaths, or current map view. Movie tabs in place details and map labels immediately filter to that title and fit its mapped locations into view. The movie selector and a single Show all action stay visible while viewing filtered details. There are no separate × buttons for clearing movie or text filters. Show all also returns the map to the city view.
- Open paired movie stills and real-site photographs, enlarge either, and expand Sources for credits and citations. Capture dates appear when verified; undated and archival photographs are retained without claiming they are current. Aerial photographs are explicitly labeled.
- Use My location to request browser geolocation and plot a position and accuracy circle. Coordinates are not saved in shared links or application storage. A secure origin and browser/OS permission are required.
- Filter canonical story dates with a range, decade preset, or playback. Returning both endpoints to their limits restores All time.
- Share selections and filters with hash links. Phones can switch between the map and directory.
- Open a person’s page to see their locations. Locations preserve their originating person or route so Back returns to the same page.
- Routes displays every matching route in a different movie color; route stops have location pages and photographs. Route connectors link documented scenes, not verified continuous travel.
- Movie colors apply to location icons; routes have distinct colors. Labels appear on hover, keyboard focus, or selection; there are no always-on featured labels. Hovered and selected labels render above other location icons. Deaths appear as full-size, separately selectable entries in All and Deaths.
- The surrounding territory uses a textured fog with a soft boundary. Islands remain masked until a researched place establishes one as part of the atlas.

## Data

`research/locations-100.json` preserves the initial 100-entry catalog: 96 places and four routes. Three unmatched production geocodes remain outside the prototype directory. The original directory contains 93 places; unresolved story addresses remain searchable without a false precise pin. `research/expansion-100.json` aggregates 100 further researched places from the three `expansion-*.json` source manifests. `route-revisions.json` and `route-extra.json` add eight further places for LAX and route stops. Heat’s robbery and meeting locations are supplemented in `heat-robberies.json` and `heat-lives.json`; `heat-routes.json` adds the armored-truck sequence and the Cheritto branch of the bank escape. `franks.json` records the diner’s eligible shared appearances and its rejected non-L.A. roles. `player-strange-days.json` and `speed-crash.json` add the requested films with story-first placements, paired photographs, and a segmented Speed bus route. `revisedPlaces` updates existing shared locations without duplicating the physical site.

Run `node scripts/prepare-data.mjs` after editing research. `scripts/enrich-data.mjs` applies story geography, dates, deaths, expansion manifests, route revisions, and photograph manifests to `src/data/atlas.json`. `research/geocodes.json` preserves production coordinates; `research/story-geography.json` records conflicting story evidence and its sources. Story positions take precedence. `research/story-map-corrections.json` replaces seven whole-street building highlights with location icons. Fictional address numbers can supply an approximate street interpolation; street-only references use a representative street point, explicitly marked approximate. Aunt Ruth’s point follows the screenplay’s Fountain-to-Sunset segment. These are display estimates, not identified parcels. Broad inferences use dashed areas; unresolved city-only places have no pin. Uncontradicted filming locations remain proxies, rather than independently established canonical addresses. Dashed routes connect selected stops, not turn-by-turn paths.

Offscreen deaths are included when a cited source establishes them. `research/terminator-police.json` records the Central Division station attack and keeps the demolished Vernon production site in provenance only. Central Division / West Highland does not establish a story street address, so the station remains searchable with photographs and deaths but has no precise map pin.

Dates establish presence during a story, not continuous tenancy. Explicit dates override release years. For otherwise contemporary stories, release year is an editorial estimate displayed with `c.`. Falling Down uses June 12, 1991 from the official Cannes synopsis; Blade Runner remains in November 2019. Future dates are not replaced by production years.

`research/media-a.json`, `media-b.json`, and `media-recent.json` record photograph sources, credits, capture dates when known, and component distinctions. Actual movie frames and local site JPEGs are under `public/photos`; `credits.json` preserves provenance. Some buildings have been demolished, and current-site photographs may show their replacements or demolition. A site's image can depict a production component rather than its story geography. When per-title photographs are available, movie and time filters select the corresponding frame. Shared sites retain an explicitly named screen image so it is not silently attributed to another film.

`public/la-county.geojson` is a simplified US Census TIGERweb county boundary, including islands; provenance is in `research/county-boundary.json`. `public/story-streets.geojson` preserves OpenStreetMap reference geometry, with its query recorded in `research/street-geometry.json`; the map no longer draws entire named roads for individual buildings.

## Verify and publish

```sh
node scripts/prepare-data.mjs
npm run check:affected
```

The affected check covers time/search/state, route/person Back navigation, segmented Speed route geometry, corrected street-address icons, separate death entries, the 100-place expansion, corrected T2/LAX sites, photo coverage, county/island masking, TypeScript, and the production build. Browser checks cover approximate place icons, unlocated police-station details without a Vernon pin, and rapid pointer and keyboard timeline scrubbing, visible filter clearing, person and route navigation, all-route colors and stop positions within map bounds, photo enlargement, marker label appearance/stacking, movie-specific photo frames, film overview bounds, mobile layout, and the deployed page. The range handles occupy separate lanes so they remain draggable when their years coincide. Timeline filtering waits briefly for input to settle; URL writes are debounced and cannot unmount the atlas when the browser limits history updates. Geolocation error handling is available when a browser or OS declines or cannot supply a position.

Pushing `main` runs `.github/workflows/pages.yml`, checks and builds the site, then deploys `dist` to GitHub Pages. Vite's relative base supports the `/movie-map/` project path.

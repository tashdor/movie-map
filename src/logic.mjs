export function timeBounds(appearance) {
  const t = appearance.story_time;
  if (!t || t.year == null) return null;
  return [t.year, t.end_year ?? t.year];
}

export function matchingAppearances(place, time) {
  if (time.all) return place.appearances;
  return place.appearances.filter(a => {
    const bounds = timeBounds(a);
    return bounds ? bounds[0] <= time.to && bounds[1] >= time.from : time.undated;
  });
}

export function filterPlaces(places, { query = '', category = 'all', film = '', time = { all: true } }) {
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[’'\-]/g,'');
  const tokens = normalize(query.replace(/\b(?:edy|edie)\b/gi,'Eady')).trim().split(/\s+/).filter(Boolean);
  return places.filter(p => {
    const appearances = matchingAppearances(p, time);
    if (!appearances.length || (category !== 'all' && !appearances.some(a=>(a.categories||p.categories).includes(category)))) return false;
    if (film && !appearances.some(a => a.title === film)) return false;
    const names = appearances.length === p.appearances.length ? [p.name,p.short] : [];
    const haystack = normalize([...names, p.address, p.area, ...appearances.flatMap(a => [a.title, a.story_role, a.filming_component, ...(a.characters || []).map(c => c.name)])].join(' '));
    return tokens.every(t => haystack.includes(t));
  });
}

export function timeLabel(a) {
  const t = a.story_time;
  if (!t || t.year == null) return t?.month === 12 && t.day === 24 ? 'Christmas Eve · year unconfirmed' : 'Date unconfirmed';
  if (t.end_year) return t.precision === 'decade' ? `c. ${t.year}s` : `${t.year}–${t.end_year}`;
  const prefix = t.certainty === 'approximate' ? 'c. ' : '';
  return `${prefix}${t.month ? new Intl.DateTimeFormat('en', {month:'short', timeZone:'UTC'}).format(new Date(Date.UTC(t.year, t.month - 1, 1))) + ' ' : ''}${t.year}`;
}

export function readState(hash) {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const from = Number(q.get('from')), to = Number(q.get('to'));
  const ranged = q.has('from') && q.has('to') && Number.isFinite(from) && Number.isFinite(to);
  return { selected: Number(q.get('place')) || null, route: Number(q.get('route')) || null, query: q.get('q') || '', category: ['home','work','hangout','event'].includes(q.get('type')) ? q.get('type') : 'all', film: q.get('film') || '', tab: q.get('tab') === 'people' ? 'people' : q.get('tab') === 'journeys' ? 'journeys' : 'places', time: { all: !ranged, from: ranged ? Math.max(1930, Math.min(2030, Math.min(from,to))) : 1930, to: ranged ? Math.max(1930, Math.min(2030, Math.max(from,to))) : 2030, undated: q.get('undated') === '1' } };
}

export function stateHash(state) {
  const q = new URLSearchParams();
  if (state.selected) q.set('place', state.selected);
  if (state.route) q.set('route', state.route);
  if (state.query) q.set('q', state.query);
  if (state.category !== 'all') q.set('type', state.category);
  if (state.film) q.set('film', state.film);
  if (state.tab !== 'places') q.set('tab', state.tab);
  if (!state.time.all) { q.set('from', state.time.from); q.set('to', state.time.to); if (state.time.undated) q.set('undated','1'); }
  return q.toString() ? '#' + q : '';
}

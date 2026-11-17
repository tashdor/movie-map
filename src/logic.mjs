export function timeBounds(appearance) {
  const t = appearance.story_time;
  if (!t || t.year == null) return null;
  return [t.year, t.end_year ?? t.year];
}

export function storySettingLabel(setting,detail=false){
  if(setting?.canonicalLA!==false)return '';
  const label=setting.certainty==='unconfirmed'?'L.A. setting unconfirmed':'Set outside L.A.';
  return detail?`${label} · ${setting.name}`:label;
}

export function matchingAppearances(place, time) {
  if (time.all || time.from <= 1930 && time.to >= 2030) return place.appearances;
  return place.appearances.filter(a => {
    const bounds = timeBounds(a);
    return bounds ? bounds[0] <= time.to && bounds[1] >= time.from : time.undated;
  });
}

export function filterPlaces(places, { query = '', category = 'all', film = '', laOnly = false, time = { all: true } }) {
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[.’'\-]/g,'');
  const tokens = normalize(query.replace(/\b(?:edy|edie)\b/gi,'Eady').replace(/\bmacauley\b/gi,'McCauley')).trim().split(/\s+/).filter(Boolean);
  return places.filter(p => {
    const appearances = matchingAppearances(p, time).filter(a=>(!film||a.title===film)&&(!laOnly||(a.storySetting||p.storySetting)?.canonicalLA!==false));
    if (!appearances.length || (category !== 'all' && !appearances.some(a=>(a.categories||p.categories).includes(category)))) return false;
    if (film && !appearances.some(a => a.title === film)) return false;
    const names = appearances.length === p.appearances.length ? [p.name,p.short] : [];
    const haystack = normalize([...names, p.address, p.area, p.placement?.address||'', p.storySetting?.name||'', ...(p.deaths||[]).filter(d=>appearances.some(a=>a.title===d.title)).flatMap(d=>[d.label||'',...d.people]), ...appearances.flatMap(a => [a.title, a.story_role, a.filming_component, ...(a.characters || []).map(c => c.name)])].join(' '));
    return tokens.every(t => haystack.includes(t));
  });
}

export function timeLabel(a) {
  const t = a.story_time;
  if (!t || t.year == null) return t?.month === 12 && t.day === 24 ? 'Christmas Eve · year unconfirmed' : 'Date unconfirmed';
  if (t.end_year) return t.precision === 'decade' ? `c. ${t.year}s` : `${t.year}–${t.end_year}`;
  const prefix = t.certainty === 'approximate' ? 'c. ' : '';
  return `${prefix}${t.day ? t.day+' ' : ''}${t.month ? new Intl.DateTimeFormat('en', {month:'short', timeZone:'UTC'}).format(new Date(Date.UTC(t.year, t.month - 1, 1))) + ' ' : ''}${t.year}`;
}

export function readState(hash) {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const from = Number(q.get('from')), to = Number(q.get('to'));
  const ranged = q.has('from') && q.has('to') && Number.isFinite(from) && Number.isFinite(to);
  let selected = Number(q.get('place')) || null, route = Number(q.get('route')) || null;
  const retiredRoute = {99:202,225:213}[route];
  if(retiredRoute){selected ||= retiredRoute;route=null;}
  if(selected===203)selected=202;
  return { laOnly:q.get('setting')==='la', selected, route, basemap:q.get('view')==='satellite'?'satellite':'map', person:q.get('person')||null, query: q.get('q') || '', category: ['home','work','hangout','event','death'].includes(q.get('type')) ? q.get('type') : 'all', film: q.get('film') || '', tab: retiredRoute?'places':q.get('tab') === 'people' ? 'people' : q.get('tab') === 'journeys' ? 'journeys' : 'places', time: { all: !ranged || Math.min(from,to)<=1930 && Math.max(from,to)>=2030, from: ranged ? Math.max(1930, Math.min(2030, Math.min(from,to))) : 1930, to: ranged ? Math.max(1930, Math.min(2030, Math.max(from,to))) : 2030, undated: q.get('undated') === '1' } };
}

export function stateHash(state) {
  const q = new URLSearchParams();
  if (state.laOnly) q.set('setting','la');
  if (state.selected) q.set('place', state.selected);
  if (state.route) q.set('route', state.route);
  if (state.person) q.set('person',state.person);
  if (state.query) q.set('q', state.query);
  if (state.category !== 'all') q.set('type', state.category);
  if (state.film) q.set('film', state.film);
  if (state.tab !== 'places') q.set('tab', state.tab);
  if (state.basemap === 'satellite') q.set('view','satellite');
  if (!state.time.all) { q.set('from', state.time.from); q.set('to', state.time.to); if (state.time.undated) q.set('undated','1'); }
  return q.toString() ? '#' + q : '';
}

export function peopleForEntry(place){
  const names=place.isDeath||place.category==='death'?(place.deaths||[]).flatMap(d=>d.people):place.appearances.flatMap(a=>a.characters?.map(c=>c.name)||place.people);
  return [...new Set(names)];
}

export function associatedPeople(place){
  if(place.baseId&&place.isDeath)return peopleForEntry(place);
  return [...new Set(place.appearances.flatMap(a=>a.characters?.map(c=>c.name)||place.people))];
}

/** @param {{coordinates?: number[], address?: string} | null} [site] */
export function filmingSiteMapsUrl(place,site=null){
  const coordinates=site?site.coordinates:place.productionCoordinates||(place.placement?.kind==='filming-proxy'?place.coordinates:null);
  const verifiedAddress=!site&&place.mapsQuery;
  const query=verifiedAddress||(coordinates?`${coordinates[1]},${coordinates[0]}`:[site?.address||place.address,place.area].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function displayEntries(places,filters={}){
  const {category='all',time={all:true},film='',laOnly=false}=filters;
  return filterPlaces(places,{...filters,category:'all'}).flatMap(p=>{
    const active=matchingAppearances(p,time).filter(a=>(!film||a.title===film)&&(!laOnly||(a.storySetting||p.storySetting)?.canonicalLA!==false));
    if(!active.length)return [];
    const deaths=(p.deaths||[]).filter(d=>active.some(a=>a.title===d.title));
    const categories=[...new Set(active.flatMap(a=>a.categories||p.categories))];
    const mediaTitle=film||(active.length===1?active[0].title:null);
    const media=mediaTitle&&p.mediaByTitle?.[mediaTitle]||p.media;
    const settings=active.map(a=>a.storySetting||p.storySetting),storySetting=settings.find(s=>s?.canonicalLA===false)||settings.find(Boolean);
    const base={...p,...(storySetting?{storySetting}:{}),media,appearances:active,deaths,categories,category:active.length!==p.appearances.length?(active[0].categories?.find(c=>c!=='death')||p.category):p.category};
    const entries=[];
    if(category==='all'||category!=='death'&&categories.includes(category)||category==='death'&&p.category==='death')entries.push({...base,isDeath:p.category==='death'});
    if(deaths.length&&p.category!=='death'&&(category==='all'||category==='death')){
      const people=[...new Set(deaths.flatMap(d=>d.people))];
      entries.push({...base,id:-p.id,baseId:p.id,isDeath:true,category:'death',categories:['death'],name:deaths.length===1&&deaths[0].label|| (people.length===1?`${people[0]}’s death`:`Deaths at ${p.name}`)});
    }
    return entries;
  });
}
export function selectPlace(state,id){return {...state,selected:id,route:state.tab==='journeys'?state.route:null,person:state.tab==='people'?state.person:null};}
export function backState(state){if(state.selected)return {...state,selected:null};if(state.route)return {...state,route:null};if(state.person)return {...state,person:null};return state;}

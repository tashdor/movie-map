import {overlayParam} from './reference-overlays.mjs';
import {readState as readNumericState} from './logic.mjs';
import {redactText,REDACTED} from './spoilers.mjs';

export function slugify(text){
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48).replace(/-$/,'');
}
function namesIndex(names){
  const byName=new Map(),bySlug=new Map();
  for(const name of [...new Set(names)].sort()){
    const base=slugify(redactText(name).replaceAll(REDACTED,''))||'character';
    let slug=base,index=2;while(bySlug.has(slug))slug=`${base}-${index++}`;
    byName.set(name,slug);bySlug.set(slug,name);
  }
  return {byName,bySlug};
}
export function createAtlasLinks(data,slugs){
  const places=new Map(Object.entries(slugs.places).map(([id,slug])=>[slug,Number(id)]));
  const routes=new Map(Object.entries(slugs.journeys).map(([id,slug])=>[slug,Number(id)]));
  const films=namesIndex(data.places.flatMap(p=>p.appearances.map(a=>a.title)));
  const people=namesIndex(data.places.flatMap(p=>p.appearances.flatMap(a=>a.characters?.map(c=>c.name)||p.people)));
  const resolve=(value,index)=>value&&index.has(value)?index.get(value):value;
  function readState(hash){
    const fragment=hash.replace(/^#/,'');
    if(!fragment||fragment.split('?')[0].includes('='))return readNumericState(hash);
    const [path,search='']=fragment.split('?'),q=new URLSearchParams(search);
    const [kind,slug]=path.split('/');
    if(places.has(path))q.set('place',String(places.get(path)));
    else if(kind==='route'&&routes.has(slug)){q.set('route',String(routes.get(slug)));if(!q.has('tab'))q.set('tab','journeys');}
    else if(kind==='person'&&people.bySlug.has(slug)){q.set('person',people.bySlug.get(slug));if(!q.has('tab'))q.set('tab','people');}
    else if(kind==='film'&&films.bySlug.has(slug))q.set('film',films.bySlug.get(slug));
    else if(path==='routes')q.set('tab','journeys');else if(path==='people')q.set('tab','people');
    if(q.has('route')){q.set('route',String(resolve(q.get('route'),routes)));if(!q.has('tab'))q.set('tab','journeys');}
    if(q.has('person')){q.set('person',resolve(q.get('person'),people.bySlug));if(!q.has('tab'))q.set('tab','people');}
    if(q.has('film'))q.set('film',resolve(q.get('film'),films.bySlug));
    return readNumericState('#'+q);
  }
  function stateHash(state){
    const place=state.selected&&slugs.places[state.selected],route=state.route&&slugs.journeys[state.route],person=state.person&&people.byName.get(state.person),film=state.film&&films.byName.get(state.film);
    let path=place|| (route?`route/${route}`:person?`person/${person}`:state.tab==='journeys'?'routes':state.tab==='people'?'people':film?`film/${film}`:'');
    const q=new URLSearchParams();
    if(state.laOnly)q.set('setting','la');
    if(overlayParam(state))q.set('layers',overlayParam(state));
    if(state.selected&&!place)q.set('place',String(state.selected));
    if(state.route&&(place||!route))q.set('route',route||String(state.route));
    if(state.person&&(place||route||!person))q.set('person',person||state.person);
    if(state.query)q.set('q',state.query);
    if(state.category!=='all')q.set('type',state.category);
    if(state.film&&!path.startsWith('film/'))q.set('film',film||state.film);
    const inferredTab=path==='routes'||path.startsWith('route/')||q.has('route')?'journeys':path==='people'||path.startsWith('person/')||q.has('person')?'people':'places';
    if(state.tab!==inferredTab)q.set('tab',state.tab);
    if(state.basemap==='satellite')q.set('view','satellite');
    if(!state.time.all){q.set('from',state.time.from);q.set('to',state.time.to);if(state.time.undated)q.set('undated','1');}
    if(!path&&q.size)path=state.query?'search':'places';
    return path||q.size?'#'+path+(q.size?'?'+q:''):'';
  }
  return {readState,stateHash};
}

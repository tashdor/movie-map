import fs from 'node:fs';
const read=(path,fallback={})=>fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):fallback;
const box=([sw,ne])=>({type:'Polygon',coordinates:[[sw,[ne[0],sw[1]],ne,[sw[0],ne[1]],sw]]});
const deaths={4:['Trejo'],9:['Waingro'],11:['Pris'],20:['Nick'],23:['William Foster / D-Fens'],25:['Pierce Patchett'],27:['Dick Stensland','Susan Lefferts'],36:['Donny Kerabatsos'],42:['Maynard'],43:['Brett'],45:['Joe Cabot','Nice Guy Eddie','Mr. Orange'],54:['Ida Sessions'],58:['Evelyn Mulwray'],60:['Shannon'],63:['Standard Gabriel'],64:['Blanche'],65:['Daniel'],71:['Roger'],79:['Ginger Ventura','Matt'],82:['Gun shop owner'],84:['Todd Voight','Janelle Voight'],88:['Diane Selwyn']};
const deathLabels={79:'Ginger Ventura & Matt’s deaths',84:'Todd & Janelle Voight’s deaths'};
const names={3:'Vincent & Justine Hanna’s home',4:'Trejo’s home',5:'Kelso’s home',6:'Eady’s bookstore',7:'Bob’s Big Boy',8:'Kate Mantilini',9:'Waingro’s hotel',10:'The Blue Room',14:'LAPD headquarters',19:'Whammy Burger',20:'Military surplus store',21:'Bank protest',22:'MacArthur Park',23:'Venice Pier',26:'Hush-Hush office',27:'Nite Owl',28:'Frolic Room',29:'Formosa Cafe',30:'LAPD headquarters',35:'Jeffrey Lebowski’s mansion',36:'Hollywood Star Lanes',41:'Hawthorne Grill',43:'Brett’s apartment',45:'The warehouse',46:'Pat & Lorraine’s',47:'Karina’s Wholesale Diamonds',50:'Cockatoo Inn',51:'Del Amo Fashion Center',52:'Sam’s Hofbrau',58:'Chinatown',63:'The pawn shop',64:'Pink Motel',68:'Annie’s office / Vincent’s pickup',70:'Quality Cafe',72:'Sandman’s home',73:'Sara’s home',74:'Pacific Dining Car',77:'Tre’s school',78:'Westside restaurant',81:'Big Jeff’s',86:'The Galleria',92:'Toretto’s Market',95:'The Lighthouse Cafe',96:'Rialto Theatre'};
export function enrich(atlas){
  const geography=read('research/story-geography.json',{overrides:[],sources:[]});
  const geocodes=read('research/story-geocodes.json');
  const media={};
  for(const path of ['research/media-a.json','research/media-b.json','research/media-recent.json']){
    const raw=read(path);for(const item of Array.isArray(raw)?raw:Object.values(raw))if(item?.id&&(item.screen||item.place))media[item.id]={...media[item.id],...item};
  }
  for(const pair of Object.values(media))for(const kind of ['screen','place'])if(pair[kind]){const photo=pair[kind];if(photo.captureDate&&/^\d{4}(?:-\d{2}){0,2}$/.test(photo.captureDate))photo.date=photo.captureDate;if(photo.licenseUrl)photo.license=photo.licenseUrl;}
  const sourceIds=new Set(atlas.sources.map(s=>s.id));
  for(const s of geography.sources)if(!sourceIds.has(s.id)){atlas.sources.push({...s,source_type:s.type});sourceIds.add(s.id);}
  const byId=new Map(atlas.places.map(p=>[p.id,p]));
  for(const p of atlas.places){
    delete p.description;
    p.productionCoordinates=p.coordinates;
    p.placement={kind:'filming-proxy',address:p.area,precision:p.precision};
    p.name=names[p.id]||p.name;p.short=p.name;
    const o=geography.overrides.find(x=>x.id===p.id);
    if(o){
      p.placement={kind:o.inference?'inferred':o.precision==='unlocated'?'unknown':'screen',address:o.storyAddressStatus?'Los Angeles · exact address unknown':o.storyAddress,precision:o.precision,reason:o.reason,sourceIds:o.sourceIds,geometry:o.geometry||undefined,viewport:o.suggestedViewport};
      p.coordinates=o.coordinates;
      if(!p.coordinates&&['area_explicit','city_explicit'].includes(o.precision)&&o.suggestedViewport){p.placement.geometry=box(o.suggestedViewport);p.placement.kind='inferred';p.coordinates=[(o.suggestedViewport[0][0]+o.suggestedViewport[1][0])/2,(o.suggestedViewport[0][1]+o.suggestedViewport[1][1])/2];}
      if(o.geometry){p.placement.viewport=[[Math.min(...o.geometry.coordinates[0].map(c=>c[0])),Math.min(...o.geometry.coordinates[0].map(c=>c[1]))],[Math.max(...o.geometry.coordinates[0].map(c=>c[0])),Math.max(...o.geometry.coordinates[0].map(c=>c[1]))]];p.placement.kind='inferred';}
      if(geocodes[p.id])p.coordinates=geocodes[p.id].coordinates;
    }
    if(p.id===65){p.address='4331 Leimert Boulevard';p.notes='Exterior: 4331 Leimert Boulevard. Interior: Grand Star Jazz Club, 943 Sun Mun Way.';}
    if(p.id===20){p.placement={kind:'inferred',address:'Central Los Angeles · estimated',precision:'area_inferred',reason:'The production site on Sunset Boulevard conflicts with a westward narrative progression. Exact story position is not established.',sourceIds:['falling_sites'],geometry:box([[-118.37,34.038],[-118.29,34.085]]),viewport:[[-118.37,34.038],[-118.29,34.085]]};p.coordinates=[-118.332,34.061];}
    if(p.id===30){p.placement={kind:'screen',address:'Los Angeles City Hall',precision:'building_exterior',sourceIds:['confidential_locations']};p.coordinates=[-118.2436,34.0537];}
    if(p.id===42){p.placement={kind:'inferred',address:'Fletcher Drive / Atwater Village · estimated',precision:'area_inferred',sourceIds:['pulp_locations'],geometry:box([[-118.267,34.095],[-118.242,34.112]]),viewport:[[-118.267,34.095],[-118.242,34.112]]};p.coordinates=[-118.254,34.103];}
    if(p.id===45){p.appearances=p.appearances.filter(a=>a.story_role!=='Mr. Orange’s apartment'&&a.story_role!=="Mr. Orange's apartment");p.appearances[0].story_role='The warehouse';}
    if(p.id===92){p.appearances=p.appearances.filter(a=>a.title!=='Falling Down');p.people=p.people.filter(n=>n!=='Mr. Lee');}
    if(media[p.id]){p.media=media[p.id];if(p.media.screen)p.media.screen={...p.media.screen,title:p.media.screen.title||p.appearances[0].title};}
    for(const a of p.appearances){
      if(a.title==='Falling Down')a.story_time={year:1991,month:6,day:12,precision:'day',certainty:'official_synopsis',basis:'Official Cannes French synopsis: 12 June 1991.',source_ids:['falling_cannes']};
      else if(a.title==='The Big Lebowski')a.story_time={year:1991,precision:'year',certainty:'approximate',basis:'Gulf War-era setting, earlier than the film’s release.',source_ids:['lebowski_script']};
      else if(!a.story_time||a.story_time.year===null)a.story_time={...a.story_time,year:a.release_year,precision:a.story_time?.month?'day':'year',certainty:'approximate',basis:'Contemporary setting; release year used as an editorial estimate.',source_ids:a.source_ids};
      if(p.id===77)a.story_time={year:1984,precision:'year',certainty:'approximate',basis:'Childhood section before the seven-year jump.',source_ids:a.source_ids};
      if(p.id===79||p.id===84)a.source_ids=[...new Set([...a.source_ids,p.id===79?'terminator_afi_story':'t2_afi_time'])];
      if(deaths[p.id]){a.categories=[...new Set([...(a.categories||p.categories),'death'])];}
    }
    if(deaths[p.id]){p.categories=[...new Set([...p.categories,'death'])];p.deaths=[{title:p.appearances[0].title,people:deaths[p.id],...(deathLabels[p.id]?{label:deathLabels[p.id]}:{})}];}
  }
  // Mr. Lee's interior is a production component of the same story market, not a second market at Toretto's.
  if(byId.has(18))byId.get(18).notes='Exterior filmed at 464 North Madison Avenue; interior at Bob’s Market, 1234 Bellevue Avenue.';
  for(const j of atlas.journeys){
    delete j.description;
    j.name={97:'D-Fens',98:'Bank robbery',100:'First street race'}[j.id];
    if(j.id===97){j.year=1991;j.source_ids.push('falling_cannes');}
    if(j.id===100)j.year=2001;
    j.stops=j.stops.map(s=>s.placeId&&byId.get(s.placeId)?.coordinates?{...s,coordinates:byId.get(s.placeId).coordinates,name:byId.get(s.placeId).name}:s);
  }
  const expanded=['research/expansion-noir.json','research/expansion-thrillers.json','research/expansion-lives.json'].map(path=>read(path,{places:[],sources:[],audit:[]}));
  const catalog={schema_version:1,researched_on:'2026-11-15',places:expanded.flatMap(d=>d.places),sources:[...new Map(expanded.flatMap(d=>d.sources).map(s=>[s.id,s])).values()],audit:expanded.flatMap(d=>d.audit||[])};
  if(catalog.places.length!==100)throw Error('Expansion must contain 100 researched places');
  fs.writeFileSync('research/expansion-100.json',JSON.stringify(catalog,null,2)+'\n');
  const secondPaths=['research/expansion2-crime.json','research/expansion2-classic.json','research/expansion2-lives.json','research/expansion2-tv.json'];
  const second=secondPaths.map(path=>read(path,{places:[],sources:[],audit:[]}));
  const secondCatalog={schema_version:1,researched_on:'2026-11-17',places:second.flatMap(d=>d.places),sources:[...new Map(second.flatMap(d=>d.sources).map(s=>[s.id,s])).values()],audit:second.flatMap(d=>d.audit||[])};
  if(secondCatalog.places.length!==100||new Set(secondCatalog.places.map(p=>p.id)).size!==100)throw Error('Second expansion must contain 100 distinct researched places');
  fs.writeFileSync('research/expansion2-100.json',JSON.stringify(secondCatalog,null,2)+'\n');
  for(const path of ['research/expansion-noir.json','research/expansion-thrillers.json','research/expansion-lives.json','research/route-revisions.json','research/route-extra.json','research/heat-robberies.json','research/heat-lives.json','research/franks.json','research/heat-routes.json','research/terminator-police.json','research/player-strange-days.json','research/speed-crash.json','research/smoke-house.json','research/voyager-locations.json','research/live-die-chase.json','research/argo-locations.json',...secondPaths,'research/north-county.json','research/noncanonical-bttf.json','research/extra-halloween-valley.json','research/extra-cult-films.json','research/extra-lethal-weapon.json','research/extra-last-action-hero.json']){
    const extra=read(path,{places:[],sources:[]});
    for(const source of extra.sources){if(!sourceIds.has(source.id)){atlas.sources.push(source);sourceIds.add(source.id);}}
    for(const place of extra.places){
      if(place.mergeInto){
        const shared=byId.get(place.mergeInto);if(!shared)throw Error(`Missing shared place ${place.mergeInto}`);
        shared.placement||=place.placement;
        if(shared.placement&&place.placement){
          shared.placement.reason||=place.placement.reason;
          shared.placement.sourceIds=[...new Set([...(shared.placement.sourceIds||[]),...(place.placement.sourceIds||[])])];
        }
        shared.mediaByTitle||={};
        if(shared.media?.screen?.title&&!shared.mediaByTitle[shared.media.screen.title])shared.mediaByTitle[shared.media.screen.title]=shared.media;
        for(const appearance of place.appearances){
          shared.appearances.push({...appearance,storySetting:appearance.storySetting||place.storySetting});
          if(place.media)shared.mediaByTitle[appearance.title]=place.mediaByTitle?.[appearance.title]||place.media;
        }
        shared.people=[...new Set([...shared.people,...place.people])];shared.categories=[...new Set([...shared.categories,...place.categories])];
        if(place.deaths)shared.deaths=[...(shared.deaths||[]),...place.deaths];
        continue;
      }
      if(byId.has(place.id))throw Error(`Duplicate place ${place.id}`);atlas.places.push(place);byId.set(place.id,place);
    }
    for(const revised of extra.revisedPlaces||[]){const place=byId.get(revised.id);if(!place)throw Error(`Missing revised place ${revised.id}`);Object.assign(place,revised);}
    for(const revised of extra.journeys||[]){const index=atlas.journeys.findIndex(j=>j.id===revised.id);if(index<0)atlas.journeys.push(revised);else atlas.journeys[index]=revised;}
  }
  const corrections=read('research/story-map-corrections.json',{corrections:[],sources:[]});
  for(const source of corrections.sources)if(!sourceIds.has(source.id)){atlas.sources.push(source);sourceIds.add(source.id);}
  for(const correction of corrections.corrections){const place=byId.get(correction.id);if(!place)throw Error(`Missing corrected place ${correction.id}`);Object.assign(place,correction);}
  for(const path of ['research/property-links-early.json','research/property-links-late.json']){
    for(const {id,...link} of read(path,{entries:[]}).entries){
      const place=byId.get(id);if(!place)throw Error(`Missing property-link place ${id}`);
      if(!place.appearances.some(a=>(a.categories||place.categories).includes('home')))throw Error(`Property link is not a home: ${id}`);
      place.propertyLinks=[...(place.propertyLinks||[]),link];
    }
  }
  for(const update of read('research/media-improvements.json',{updates:[]}).updates){
    const place=byId.get(update.id);if(!place)throw Error(`Missing improved-photo place ${update.id}`);
    if(!place.appearances.some(a=>a.title===update.title))throw Error(`Photo title does not appear at ${update.id}: ${update.title}`);
    const original=place.mediaByTitle?.[update.title]||(place.media?.screen?.title===update.title?place.media:undefined);
    const gallery=[...(update.screenGallery||[]),...((update.preserveExistingScreen||update.keepExisting)&&original?.screen?[original.screen]:[])];
    const pair={...(original||{place:place.media?.place}),screen:{...update.screen,title:update.title},screenGallery:[...new Map(gallery.filter(p=>p.src!==update.screen.src).map(p=>[p.src,{...p,title:update.title}])).values()]};
    if(update.id===1){delete pair.note;if(place.media)delete place.media.note;}
    if(place.appearances.length>1||place.mediaByTitle){place.mediaByTitle||={};const primaryTitle=place.media?.screen?.title;if(primaryTitle&&!place.mediaByTitle[primaryTitle])place.mediaByTitle[primaryTitle]=place.media;place.mediaByTitle[update.title]=pair;}
    if(place.appearances[0].title===update.title||place.media?.screen?.title===update.title)place.media=pair;
  }
  const race=byId.get(208);if(race?.routeAnchors){const j=atlas.journeys.find(j=>j.id===100);j.stops=race.routeAnchors.map(s=>({...s,placeId:208}));j.geometry=race.geometry||race.placement?.geometry;j.source_ids=race.appearances[0].source_ids;}
  const car=byId.get(211);if(car){const j=atlas.journeys.find(j=>j.id===97);j.stops[0]={name:car.name,coordinates:car.coordinates,placeId:211};j.source_ids=[...new Set([...j.source_ids,...car.appearances[0].source_ids])];}
  for(const p of atlas.places){if(p.media)media[p.id]={...p.media,...(p.mediaByTitle?{byTitle:p.mediaByTitle}:{})};for(const component of p.components||[])if(component.media)media[component.id]=component.media;}
  fs.writeFileSync('public/photos/credits.json',JSON.stringify(media,null,2)+'\n');
  return atlas;
}

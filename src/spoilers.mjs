export const REDACTED='██████';

const reveal=/(?<![\p{L}\p{N}])(?:death|deaths|dies|died|dead(?!\s+again)|kill(?:ed|s|ing)?|murder\p{L}*|massacre|corpse|suicid\p{L}*|victim\p{L}*|betray\p{L}*|undercover|reincarn\p{L}*|epilogue|finale|final[\s_]+confrontation|money.switch|killer|burial|hostage|ambush|identity|reveal\p{L}*|mortally[\s_]+wounded|fatal(?:ly)?[\s_]+(?:shot|explosion)|buried)(?![\p{L}\p{N}])/giu;
const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function redactText(text='',phrases=[]){
  let result=text;
  for(const phrase of [...phrases].sort((a,b)=>b.length-a.length))result=result.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(phrase)}(?![\\p{L}\\p{N}])`,'giu'),REDACTED);
  return result.replace('Alexander Revelle / Sam Bouchard',`Alexander Revelle / ${REDACTED}`).replace(reveal,REDACTED);
}
export const accessibleText=(text='')=>text.replaceAll(REDACTED,'Redacted');
export const isRedacted=(text='')=>text.includes(REDACTED);
export function sourceIsRedacted(text,url='',force=false){
  let decoded=url;try{decoded=decodeURIComponent(url);}catch{/* Keep malformed links inert if their visible label is redacted. */}
  return force||isRedacted(text)||redactText(text)!==text||/death|murder|massacre|suicid|ending|shooting(?![-_+ ]*locations?)|killer|twist/i.test(decoded);
}

function coverPhoto(photo){
  if(!photo)return photo;
  return {src:'',sourceUrl:'',credit:REDACTED,title:photo.title,alt:'Redacted',redacted:true};
}
function cover(value,phrases=[]){
  if(typeof value==='string')return redactText(value,phrases);
  if(Array.isArray(value))return value.map(item=>cover(item,phrases));
  if(!value||typeof value!=='object')return value;
  if('src' in value)return coverPhoto(value);
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,cover(item,phrases)]));
}
// Paths in the editorial audit can target a single film at a shared location.
function maskPath(object,path,phrases=[]){
  if(Array.isArray(object)){for(const item of object)maskPath(item,path,phrases);return;}
  const [part,...rest]=path.split(/\.(?![^\[]*\])/u);
  const match=part.match(/^([^\[]+)(?:\[([^\]]+)\])?$/u);if(!match||!object)return;
  const [,key,selector]=match,value=object[key];if(value===undefined)return;
  if(selector!==undefined){
    if(!Array.isArray(value))return;
    value.forEach((item,index)=>{
      const [field,...rhs]=selector.split('=');
      const matches=/^\d+$/.test(selector)?index===Number(selector):String(typeof item==='string'&&field==='name'?item:item?.[field])===rhs.join('=');
      if(matches){if(rest.length)maskPath(item,rest.join('.'),phrases);else value[index]=cover(item,phrases);}
    });
  }else if(rest.length)maskPath(value,rest.join('.'),phrases);else object[key]=cover(value,phrases);
}

function safePhoto(photo,phrases=[]){
  if(!photo||photo.redacted)return photo;
  return {...photo,alt:redactText(photo.alt||'',phrases),caption:redactText(photo.caption||'',phrases),note:redactText(photo.note||'',phrases),credit:redactText(photo.credit||'',phrases)};
}
function safePair(pair,coverScreen=false,phrases=[]){
  if(!pair)return pair;
  const screenPhoto=photo=>photo?.redacted||photo?.spoiler===true||photo?.spoiler!==false&&(coverScreen||isRedacted(redactText(photo?.alt||'',phrases)))?coverPhoto(photo):safePhoto(photo,phrases);
  return {...pair,screen:screenPhoto(pair.screen),screenGallery:pair.screenGallery?.map(screenPhoto),place:safePhoto(pair.place,phrases),note:redactText(pair.note||'',phrases)};
}

export function presentPlace(place,showSpoilers,audit){
  if(showSpoilers)return place;
  const result=structuredClone(place),baseId=place.baseId||Math.abs(place.id);
  const rule=audit.places.find(item=>item.id===baseId);
  for(const field of rule?.fields||[])maskPath(result,field);
  for(const {path,phrases} of rule?.redactions||[])maskPath(result,path,phrases);
  result.name=redactText(result.name);result.short=redactText(result.short);
  result.redacted=isRedacted(result.name);
  result.notes=redactText(result.notes||'');
  result.address=redactText(result.address);result.area=redactText(result.area);
  result.productionSites=result.productionSites?.map(site=>({...site,address:redactText(site.address),component:redactText(site.component||'')}));
  result.people=result.people.map(text=>redactText(text));
  if(result.placement){
    result.placement.address=redactText(result.placement.address);
    result.placement.reason=redactText(result.placement.reason||'');
  }
  result.appearances=result.appearances.map(a=>({...a,
    story_role:redactText(a.story_role),
    filming_component:redactText(a.filming_component),
    characters:(a.characters||[]).map(c=>({...c,name:redactText(c.name),relationship:redactText(c.relationship)})),
    episodes:a.episodes?.map(text=>redactText(text)),
    story_time:a.story_time?{...a.story_time,basis:redactText(a.story_time.basis||'')}:undefined,
  }));
  result.deaths=result.deaths?.map(d=>({...d,people:[REDACTED],label:REDACTED}));
  const namePhrases=rule?.redactions?.filter(r=>r.path==='name').flatMap(r=>r.phrases)||[];
  const screenTitle=result.media?.screen?.title;
  result.media=safePair(result.media,Boolean(place.isDeath||place.category==='death'||place.deaths?.some(d=>!screenTitle||d.title===screenTitle)),namePhrases);
  if(result.mediaByTitle)for(const [title,pair] of Object.entries(result.mediaByTitle))result.mediaByTitle[title]=safePair(pair,place.deaths?.some(d=>d.title===title),namePhrases);
  result.components=result.components?.map(p=>presentPlace(p,false,audit));
  return result;
}

export function presentJourney(journey,showSpoilers,audit,places){
  if(showSpoilers)return journey;
  const result=structuredClone(journey),rule=audit.journeys.find(item=>item.id===journey.id);
  for(const field of rule?.fields||[])maskPath(result,field);
  for(const {path,phrases} of rule?.redactions||[])maskPath(result,path,phrases);
  result.name=redactText(result.name);result.redacted=isRedacted(result.name);
  result.precision=redactText(result.precision||'');
  result.stops=result.stops.map(s=>{
    const placeRule=audit.places.find(item=>item.id===s.placeId);
    const namePhrases=placeRule?.redactions?.filter(r=>r.path==='name').flatMap(r=>r.phrases)||[];
    const name=redactText(s.name,namePhrases);
    return {...s,name};
  });
  result.media=safePair(result.media,result.redacted);
  return result;
}

import {filterPlaces} from './logic.mjs';

export const REDACTED='██████';

const reveal=/(?<![\p{L}\p{N}])(?:death|deaths|dies|died|dead(?!\s+again)|kill(?:ed|s|ing)?|murder\p{L}*|massacre|corpse|suicid\p{L}*|victim\p{L}*|betray\p{L}*|undercover|reincarn\p{L}*|epilogue|finale|final[\s_]+confrontation|money.switch|killer|burial|hostage|ambush|identity|reveal\p{L}*|mortally[\s_]+wounded|fatal(?:ly)?[\s_]+(?:shot|explosion)|buried)(?![\p{L}\p{N}])/giu;
const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function redactPhrases(text='',phrases=[]){
  let result=text;
  for(const phrase of [...phrases].sort((a,b)=>b.length-a.length)){
    const start=/^[\p{L}\p{N}]/u.test(phrase)?'(?<![\\p{L}\\p{N}])':'',end=/[\p{L}\p{N}]$/u.test(phrase)?'(?![\\p{L}\\p{N}])':'';
    result=result.replace(new RegExp(`${start}${escapeRegex(phrase)}${end}`,'giu'),REDACTED);
  }
  return result;
}
export const redactText=(text='',phrases=[])=>redactPhrases(text,phrases).replace('Alexander Revelle / Sam Bouchard',`Alexander Revelle / ${REDACTED}`).replace(reveal,REDACTED);
export const accessibleText=(text='')=>text.replaceAll(REDACTED,'Redacted');
export const isRedacted=(text='')=>text.includes(REDACTED);
const deathOutcome=/(?<![\p{L}\p{N}])(?:deaths?|dies|died|kill(?:ed|ing|s)?|murders?|massacre|suicide)(?![\p{L}\p{N}])/iu;
export function isDeathEvent(place,audit){
  if(!place)return false;
  const rule=audit.places.find(item=>item.id===(place.baseId||Math.abs(place.id)));
  return Boolean(place.isDeath||place.category==='death'||rule?.deathVictims?.length||place.deaths?.length&&deathOutcome.test(place.name));
}
function identityAliases(names){
  const phrases=new Set(names);
  for(const name of names)for(const alias of name.split(/\s*\/\s*/)){
    phrases.add(alias);
    for(const match of alias.matchAll(/[“"]([^”"]+)[”"]/g))phrases.add(match[1]);
    const words=alias.replace(/[“"][^”"]+[”"]/g,'').trim().split(/\s+/);
    if(words.length>1&&words.every(word=>/^(?:[A-ZÀ-ÖØ-Þ]|van$|de$|la$)/u.test(word))){
      if(!['The','Other','Unknown'].includes(words[0]))phrases.add(words[0]);
      const last=words.at(-1);
      if(!['One','Sr.','Jr.'].includes(last))phrases.add(/^(?:van|de|la)$/i.test(words.at(-2))?words.slice(-2).join(' '):last);
    }
  }
  return [...phrases].filter(Boolean);
}
export function deathIdentityPhrases(place,audit){
  const rule=audit.places.find(item=>item.id===(place.baseId||Math.abs(place.id)));
  return identityAliases([...(place.deaths||[]).flatMap(d=>d.people),...(rule?.deathVictims||[])]);
}
export function placeSpoilerPhrases(place,audit){
  if(!place)return [];
  const rule=audit.places.find(item=>item.id===(place.baseId||Math.abs(place.id)));
  const identities=isDeathEvent(place,audit)?deathIdentityPhrases(place,audit):rule?.concealParticipants?identityAliases(place.appearances.flatMap(a=>(a.characters||[]).map(c=>c.name))):[];
  return [...new Set([...identities,...(rule?.redactions?.filter(r=>['name','short','people','appearances.characters.name'].includes(r.path)).flatMap(r=>r.phrases)||[])])];
}
export function journeySpoilerPhrases(journey,audit,places){
  return [...new Set(journey.stops.flatMap(stop=>placeSpoilerPhrases(places.find(p=>p.id===stop.placeId),audit)))];
}
export function sourceIsRedacted(text,url='',force=false,phrases=[]){
  let decoded=url;try{decoded=decodeURIComponent(url);}catch{/* Keep malformed links inert if their visible label is redacted. */}
  return force||isRedacted(text)||redactText(text,phrases)!==text||Boolean(phrases.length&&isRedacted(redactText(decoded.replace(/[-_+]/g,' '),phrases)))||/death|murder|massacre|suicid|ending|shooting(?![-_+ ]*locations?)|killer|twist/i.test(decoded);
}

function coverPhoto(photo){
  if(!photo)return photo;
  return {src:'',sourceUrl:'',credit:REDACTED,title:photo.title,alt:'Redacted',redacted:true};
}
function cover(value,phrases=[]){
  // Apply complete editorial spans before the keyword fallback can split them.
  if(typeof value==='string')return redactPhrases(value,phrases);
  if(Array.isArray(value))return value.map(item=>cover(item,phrases));
  if(!value||typeof value!=='object')return value;
  if('src' in value)return value.spoiler===false?value:coverPhoto(value);
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,cover(item,phrases)]));
}
// Paths in the editorial audit can target a single film at a shared location.
function maskPath(object,path,phrases=[],source=object){
  if(Array.isArray(object)){object.forEach((item,index)=>maskPath(item,path,phrases,source?.[index]));return;}
  const [part,...rest]=path.split(/\.(?![^\[]*\])/u);
  const match=part.match(/^([^\[]+)(?:\[([^\]]+)\])?$/u);if(!match||!object)return;
  const [,key,selector]=match,value=object[key];if(value===undefined)return;
  if(selector!==undefined){
    if(!Array.isArray(value))return;
    value.forEach((item,index)=>{
      const [field,...rhs]=selector.split('=');
      const original=source?.[key]?.[index];
      const matches=/^\d+$/.test(selector)?index===Number(selector):String(typeof original==='string'&&field==='name'?original:original?.[field])===rhs.join('=');
      if(matches){if(rest.length)maskPath(item,rest.join('.'),phrases,original);else value[index]=cover(item,phrases);}
    });
  }else if(rest.length)maskPath(value,rest.join('.'),phrases,source?.[key]);else object[key]=cover(value,phrases);
}
function applyAudit(result,original,rule){
  for(const field of rule?.fields||[])maskPath(result,field,[],original);
  const spans=(rule?.redactions||[]).flatMap(({path,phrases})=>phrases.map(phrase=>({path,phrase})));
  for(const {path,phrase} of spans.sort((a,b)=>b.phrase.length-a.phrase.length))maskPath(result,path,[phrase],original);
}

function safePhoto(photo,phrases=[]){
  if(!photo||photo.redacted)return photo;
  return {...photo,alt:redactText(photo.alt||'',phrases),caption:redactText(photo.caption||'',phrases),note:redactText(photo.note||'',phrases),credit:redactText(photo.credit||'',phrases)};
}
function safePair(pair,coverScreen=false,phrases=[],concealParticipants=false){
  if(!pair)return pair;
  const screenPhoto=photo=>photo?.redacted||photo&&concealParticipants||photo?.spoiler===true||photo?.spoiler!==false&&(coverScreen||isRedacted(redactText(photo?.alt||'',phrases)))?coverPhoto(photo):safePhoto(photo,phrases);
  return {...pair,screen:screenPhoto(pair.screen),screenGallery:pair.screenGallery?.map(screenPhoto),place:safePhoto(pair.place,phrases),note:redactText(pair.note||'',phrases)};
}

export function presentPlace(place,showSpoilers,audit,inheritedIdentities=[]){
  if(showSpoilers)return place;
  const result=structuredClone(place),baseId=place.baseId||Math.abs(place.id);
  const rule=audit.places.find(item=>item.id===baseId);
  const deathEvent=isDeathEvent(place,audit),concealParticipants=deathEvent||rule?.concealParticipants;
  const identities=concealParticipants?placeSpoilerPhrases(place,audit):inheritedIdentities;
  const safeImages=new Set((audit.review?.safeImages||[]).filter(image=>image.placeId===baseId).map(image=>image.src));
  for(const pair of [result.media,...Object.values(result.mediaByTitle||{})])for(const photo of [pair?.screen,...(pair?.screenGallery||[])])if(photo&&safeImages.has(photo.src))photo.spoiler=false;
  applyAudit(result,place,rule);
  result.name=deathEvent?REDACTED:redactText(result.name,identities);result.short=deathEvent?REDACTED:redactText(result.short,identities);
  result.redacted=isRedacted(result.name);
  result.notes=redactText(result.notes||'',identities);
  result.address=redactText(result.address);result.area=redactText(result.area);
  result.productionSites=result.productionSites?.map(site=>({...site,address:redactText(site.address),component:redactText(site.component||'',identities)}));
  result.people=concealParticipants?[]:result.people.map(text=>redactText(text,identities));
  if(result.placement){
    result.placement.address=redactText(result.placement.address);
    result.placement.reason=redactText(result.placement.reason||'',identities);
  }
  result.appearances=result.appearances.map(a=>({...a,
    story_role:deathEvent&&a.story_role===place.name?REDACTED:redactText(a.story_role,identities),
    filming_component:redactText(a.filming_component,identities),
    characters:concealParticipants?[]:(a.characters||[]).map(c=>({...c,name:redactText(c.name,identities),relationship:redactText(c.relationship,identities)})).filter(c=>c.relationship.replaceAll(REDACTED,'').replace(/[\s\p{P}]/gu,'').length>0),
    episodes:a.episodes?.map(text=>redactText(text,identities)),
    story_time:a.story_time?{...a.story_time,basis:redactText(a.story_time.basis||'',identities)}:undefined,
  }));
  // An association supported only by a concealed outcome must not remain on a person page.
  const associated=new Set(result.appearances.flatMap(a=>a.characters.map(c=>c.name)));
  result.people=result.people.filter(name=>associated.has(name));
  result.deaths=result.deaths?.map(d=>({...d,people:[REDACTED],label:REDACTED,...(d.story_role?{story_role:REDACTED}:{})}));
  const namePhrases=[...(rule?.redactions?.filter(r=>r.path==='name').flatMap(r=>r.phrases)||[]),...identities];
  const screenTitle=result.media?.screen?.title;
  result.media=safePair(result.media,Boolean(place.isDeath||place.category==='death'||place.deaths?.some(d=>!screenTitle||d.title===screenTitle)),namePhrases,concealParticipants);
  if(result.mediaByTitle)for(const [title,pair] of Object.entries(result.mediaByTitle))result.mediaByTitle[title]=safePair(pair,place.deaths?.some(d=>d.title===title),namePhrases,concealParticipants);
  result.components=result.components?.map(p=>presentPlace(p,false,audit,identities));
  return result;
}

export function presentEntries(entries,showSpoilers,audit,query=''){
  return entries.flatMap(place=>{
    const view=presentPlace(place,showSpoilers,audit);
    if(!showSpoilers&&query){
      if(!filterPlaces([view],{query}).length)return [];
      const normalize=text=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
      const visibleNames=view.appearances.flatMap(a=>a.characters.map(c=>c.name));
      const hiddenNames=place.appearances.flatMap(a=>(a.characters||[]).map(c=>c.name)).filter(name=>!visibleNames.includes(name));
      if(identityAliases(hiddenNames).some(name=>normalize(name)===normalize(query))){
        const visible=[view.name,view.address,view.area,view.placement?.address||'',...view.appearances.flatMap(a=>[a.title,a.story_role,a.filming_component,...a.characters.map(c=>c.name)])];
        if(!visible.some(text=>` ${normalize(text)} `.includes(` ${normalize(query)} `)))return [];
      }
    }
    return [view];
  });
}

export function presentJourney(journey,showSpoilers,audit,places){
  if(showSpoilers)return journey;
  const result=structuredClone(journey),rule=audit.journeys.find(item=>item.id===journey.id);
  const identities=journeySpoilerPhrases(journey,audit,places);
  applyAudit(result,journey,rule);
  result.name=redactText(result.name,identities);result.redacted=isRedacted(result.name);
  result.precision=redactText(result.precision||'',identities);
  result.stops=result.stops.map(s=>{
    const placeRule=audit.places.find(item=>item.id===s.placeId);
    const place=places.find(p=>p.id===s.placeId);
    const namePhrases=placeRule?.redactions?.filter(r=>r.path==='name').flatMap(r=>r.phrases)||[];
    const name=isDeathEvent(place,audit)?REDACTED:redactText(s.name,[...namePhrases,...identities]);
    return {...s,name};
  });
  result.media=safePair(result.media,result.redacted,identities);
  return result;
}

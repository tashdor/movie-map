export const REDACTED='██████';

const reveal=/\b(?:death|deaths|dies|died|dead(?!\s+again)|kill(?:ed|s|ing)?|murder\w*|massacre|corpse|suicid\w*|victim\w*|betray\w*|undercover|reincarn\w*|epilogue|finale|final confrontation|money.switch|killer|burial|hostage|ambush|identity|reveal\w*)\b/iu;
const aliases=['Alexander Revelle / Sam Bouchard'];
export function redactText(text=''){
  return reveal.test(text)||aliases.some(alias=>text.includes(alias))?REDACTED:text;
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
function cover(value){
  if(typeof value==='string')return REDACTED;
  if(Array.isArray(value))return value.map(cover);
  if(!value||typeof value!=='object')return value;
  if('src' in value)return coverPhoto(value);
  if('screen' in value||'place' in value)return {...value,screen:coverPhoto(value.screen),place:coverPhoto(value.place),note:value.note?REDACTED:undefined};
  if('story_role' in value)return {...value,story_role:REDACTED,filming_component:REDACTED,characters:cover(value.characters||[]),redacted:true};
  if('name' in value&&'relationship' in value)return {...value,name:REDACTED,relationship:REDACTED};
  return value;
}
// Paths in the editorial audit can target a single film at a shared location.
function maskPath(object,path){
  const [part,...rest]=path.split(/\.(?![^\[]*\])/u);
  const match=part.match(/^([^\[]+)(?:\[([^\]]+)\])?$/u);if(!match||!object)return;
  const [,key,selector]=match,value=object[key];if(value===undefined)return;
  if(selector!==undefined){
    if(!Array.isArray(value))return;
    value.forEach((item,index)=>{
      const [field,...rhs]=selector.split('=');
      const matches=/^\d+$/.test(selector)?index===Number(selector):String(typeof item==='string'&&field==='name'?item:item?.[field])===rhs.join('=');
      if(matches){if(rest.length)maskPath(item,rest.join('.'));else value[index]=cover(item);}
    });
  }else if(rest.length)maskPath(value,rest.join('.'));else object[key]=cover(value);
}

function safePhoto(photo){
  if(!photo||photo.redacted)return photo;
  if(redactText(photo.alt||'')!==photo.alt&&photo.alt)return coverPhoto(photo);
  return {...photo,alt:redactText(photo.alt||''),caption:redactText(photo.caption||''),note:redactText(photo.note||''),credit:redactText(photo.credit||'')};
}
function safePair(pair,coverScreen=false){
  if(!pair)return pair;
  return {...pair,screen:coverScreen?coverPhoto(pair.screen):safePhoto(pair.screen),place:safePhoto(pair.place),note:redactText(pair.note||'')};
}

export function presentPlace(place,showSpoilers,audit){
  if(showSpoilers)return place;
  const result=structuredClone(place),baseId=place.baseId||Math.abs(place.id);
  const rule=audit.places.find(item=>item.id===baseId);
  for(const field of rule?.fields||[])maskPath(result,field);
  const full=Boolean(place.isDeath||place.category==='death'||rule?.whole_record||isRedacted(result.name)||redactText(result.name)!==result.name);
  result.redacted=full;
  result.name=full?REDACTED:redactText(result.name);result.short=full?REDACTED:redactText(result.short);
  result.notes=full&&result.notes?REDACTED:redactText(result.notes||'');
  result.address=redactText(result.address);result.area=redactText(result.area);
  result.productionSites=result.productionSites?.map(site=>({...site,address:redactText(site.address),component:redactText(site.component||'')}));
  result.people=full?[]:result.people.map(redactText);
  if(result.placement){
    result.placement.address=redactText(result.placement.address);
    result.placement.reason=full&&result.placement.reason?REDACTED:redactText(result.placement.reason||'');
  }
  result.appearances=result.appearances.map(a=>({...a,
    redacted:full||a.redacted,
    story_role:full?REDACTED:redactText(a.story_role),
    filming_component:full?REDACTED:redactText(a.filming_component),
    characters:full?[]:(a.characters||[]).map(c=>({...c,name:redactText(c.name),relationship:redactText(c.relationship)})),
    episodes:a.episodes?.map(redactText),
    story_time:a.story_time?{...a.story_time,basis:redactText(a.story_time.basis||'')}:undefined,
  }));
  result.deaths=result.deaths?.map(d=>({...d,people:[REDACTED],label:REDACTED}));
  result.media=safePair(result.media,full||Boolean(place.deaths?.length));
  if(result.mediaByTitle)for(const [title,pair] of Object.entries(result.mediaByTitle))result.mediaByTitle[title]=safePair(pair,full||place.deaths?.some(d=>d.title===title));
  result.components=result.components?.map(p=>presentPlace(p,false,audit));
  return result;
}

export function presentJourney(journey,showSpoilers,audit,places){
  if(showSpoilers)return journey;
  const result=structuredClone(journey),rule=audit.journeys.find(item=>item.id===journey.id);
  for(const field of rule?.fields||[])maskPath(result,field);
  result.name=redactText(result.name);result.redacted=isRedacted(result.name);
  result.precision=redactText(result.precision||'');
  result.stops=result.stops.map(s=>{
    const p=places.find(p=>p.id===s.placeId);
    const name=p&&presentPlace(p,false,audit).redacted?REDACTED:redactText(s.name);
    return {...s,name};
  });
  result.media=safePair(result.media,result.redacted);
  return result;
}

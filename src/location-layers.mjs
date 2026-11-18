export const locationTypes=[['home','Homes'],['work','Work'],['hangout','Hangouts'],['event','Events'],['death','Deaths']];
const ids=locationTypes.map(([id])=>id);

export function selectedTypes(value='all'){
  if(value==='all')return [...ids];
  if(value==='none')return [];
  const requested=new Set(value.split(',')),known=ids.filter(id=>requested.has(id));
  return known.length?known:[...ids];
}

export function categoryValue(selected){
  const ordered=ids.filter(id=>selected.includes(id));
  return ordered.length===ids.length?'all':ordered.length?ordered.join(','):'none';
}

export function toggleCategory(value,id,enabled){
  const selected=new Set(selectedTypes(value));
  if(enabled)selected.add(id);else selected.delete(id);
  return categoryValue([...selected]);
}

export const eras=Array.from({length:10},(_,index)=>{const from=1930+index*10;return {label:`${from}s`,from,to:from+9};});

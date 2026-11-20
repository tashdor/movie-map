export function knownDeathCount(record){
  if(Number.isSafeInteger(record.knownCount)&&record.knownCount>0)return record.knownCount;
  return Math.max(1,new Set((record.people||[]).map(name=>name.trim().toLocaleLowerCase()).filter(Boolean)).size);
}

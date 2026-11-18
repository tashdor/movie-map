const layers=['neighborhoods','landmarks','prices'];

export function readOverlays(value=''){
  const enabled=new Set(value.split(','));
  return Object.fromEntries(layers.map(layer=>[layer,enabled.has(layer)]));
}

export const overlayParam=state=>layers.filter(layer=>state[layer]===true).join(',');

export function landmarkLinks(properties){
  let website;
  try{const url=new URL(properties.url);if(url.protocol==='https:')website=url.href;}catch{/* Omit an invalid destination. */}
  const query=[properties.name,properties.address].filter(Boolean).join(', ');
  return {website,maps:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`};
}

const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
const whole=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});

export function formatHousePrice(amount){
  if(!Number.isFinite(amount)||amount<=0)return '';
  return amount<1e6?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:0}).format(amount):compact.format(amount);
}

export function priceDescription(price){
  return `${price.kind==='asking'?'Asking price':'Zestimate'} snapshot · $${whole.format(price.amount)} · checked ${date.format(new Date(`${price.checkedOn}T00:00:00Z`))}`;
}

export function housePricePins(places){
  const pins=new Map();
  for(const place of places){
    if(place.isDeath||place.baseId||!place.categories.includes('home')||!place.coordinates||['inferred','unknown'].includes(place.placement?.kind))continue;
    const actual=place.productionCoordinates||place.coordinates;
    const [lon,lat]=place.coordinates;
    const displacement=Math.hypot((lon-actual[0])*Math.cos(lat*Math.PI/180),lat-actual[1])*111320;
    // A real property's value must not float over an editorial story position.
    if(displacement>25)continue;
    for(const link of place.propertyLinks||[]){
      if(!link.price||!formatHousePrice(link.price.amount)||pins.has(link.url))continue;
      pins.set(link.url,{key:link.url,placeId:place.id,name:place.name,titles:[...new Set(place.appearances.map(a=>a.title))],coordinates:place.coordinates,address:link.address,url:link.url,price:link.price,label:formatHousePrice(link.price.amount)});
    }
  }
  return [...pins.values()];
}

export function visiblePriceLabels(labels,{width,height}){
  const occupied=[],visible=new Set();
  for(const label of labels){
    const box={left:label.x-label.width/2-4,right:label.x+label.width/2+4,top:label.y-59,bottom:label.y-16};
    if(box.left<0||box.right>width||box.top<0||box.bottom>height)continue;
    if(occupied.some(other=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top))continue;
    occupied.push(box);visible.add(label.key);
  }
  return visible;
}

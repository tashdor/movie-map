const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
const whole=new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
const date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});

export function formatHousePrice(amount){
  if(!Number.isFinite(amount)||amount<=0)return '';
  return amount<1e6?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:0}).format(amount):compact.format(amount);
}

export function formatPropertyPrice(price){
  if(!price||!formatHousePrice(price.amount))return '';
  if(!['rent','rent-zestimate'].includes(price.kind))return formatHousePrice(price.amount);
  const minimum=compact.format(price.amount),maximum=price.maxAmount&&compact.format(price.maxAmount);
  return `${minimum}${maximum&&maximum!==minimum?`–${maximum}`:price.isFrom?'+':''}/mo`;
}

export function priceDescription(price){
  const monthly=['rent','rent-zestimate'].includes(price.kind);
  const kind=price.kind==='asking'?'Asking price':price.kind==='rent'?(price.scope==='available-units'?'Listed unit rents':'Listed rent'):price.kind==='rent-zestimate'?'Rent Zestimate':'Zestimate';
  const amount=`$${whole.format(price.amount)}${price.maxAmount&&price.maxAmount!==price.amount?`–$${whole.format(price.maxAmount)}`:price.isFrom?'+':''}${monthly?'/month':''}`;
  return `${kind} snapshot · ${amount} · checked ${date.format(new Date(`${price.checkedOn}T00:00:00Z`))}${price.note?` · ${price.note}`:''}`;
}

export function housePricePins(places){
  const pins=new Map();
  for(const place of places){
    if(place.isDeath||place.baseId||!place.categories.includes('home')||!place.coordinates)continue;
    for(const link of place.propertyLinks||[]){
      if(!link.price||!formatPropertyPrice(link.price)||pins.has(link.url))continue;
      pins.set(link.url,{key:link.url,placeId:place.id,name:place.name,titles:[...new Set(place.appearances.map(a=>a.title))],coordinates:place.coordinates,address:link.address,url:link.url,price:link.price,label:formatPropertyPrice(link.price)});
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

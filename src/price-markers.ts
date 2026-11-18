import {Marker,type Map as AtlasMap} from 'maplibre-gl';
import {housePricePins,priceDescription,visiblePriceLabels} from './property-prices.mjs';
import {filmTitle} from './films.mjs';
import {accessibleText} from './spoilers.mjs';
import {appendRedactedText} from './RedactedText';
import type {Place} from './types';

type Settings={enabled:boolean;places:Place[];selectedId:number|null};
type Pin=ReturnType<typeof housePricePins>[number];
type Record={marker:Marker;element:HTMLDivElement;pin:Pin;signature:string};

export function installPriceMarkers(map:AtlasMap,onSelect:(id:number)=>void){
  const records=new Map<string,Record>();let selectedId:number|null=null,frame:number|undefined,disposed=false;
  const clear=()=>{for(const record of records.values())record.marker.remove();records.clear();};
  function sync(){
    frame=undefined;if(disposed||!records.size)return;
    const ordered=[...records.values()].sort((a,b)=>Number(b.pin.placeId===selectedId)-Number(a.pin.placeId===selectedId)||a.pin.placeId-b.pin.placeId);
    const labels=ordered.map(({pin})=>{const point=map.project(pin.coordinates);return {key:pin.key,x:point.x,y:point.y,width:Math.max(54,pin.label.length*9+22)};});
    const element=map.getContainer(),visible=visiblePriceLabels(labels,{width:element.clientWidth,height:element.clientHeight});
    for(const [index,record] of ordered.entries()){
      record.element.hidden=!visible.has(record.pin.key);
      record.element.classList.toggle('tooltip-left-edge',labels[index].x<170);
      record.element.classList.toggle('tooltip-right-edge',labels[index].x>element.clientWidth-170);
      record.element.classList.toggle('tooltip-below',labels[index].y<170);
    }
  }
  const queue=()=>{if(frame===undefined&&records.size)frame=requestAnimationFrame(sync);};
  map.on('move',queue);map.on('resize',queue);

  return {
    update({enabled,places,selectedId:nextSelected}:Settings){
      selectedId=nextSelected;
      if(!enabled){if(frame!==undefined)cancelAnimationFrame(frame);frame=undefined;clear();return;}
      const active=new Set<string>();
      for(const pin of housePricePins(places)){
        active.add(pin.key);const signature=JSON.stringify([pin.name,pin.titles,pin.address,pin.price]);
        let record=records.get(pin.key);
        if(!record){
          const element=document.createElement('div');element.className='house-price-marker';
          record={element,marker:new Marker({element,anchor:'bottom',offset:[0,-23]}).setLngLat(pin.coordinates).addTo(map),pin,signature:''};records.set(pin.key,record);
        }
        if(record.signature!==signature){
          const button=document.createElement('button');button.type='button';button.className='house-price-callout';button.textContent=pin.label;
          button.setAttribute('aria-label',`Open ${accessibleText(pin.name)} · Filming property at ${pin.address} · Zillow ${priceDescription(pin.price)}`);
          button.addEventListener('click',event=>{event.stopPropagation();onSelect(pin.placeId);});
          const tooltip=document.createElement('div');tooltip.className='house-price-tooltip';tooltip.setAttribute('role','tooltip');
          const movies=document.createElement('span');movies.textContent=pin.titles.map(filmTitle).join(' / ');
          const name=document.createElement('strong');appendRedactedText(name,pin.name);
          const address=document.createElement('span');address.textContent=`Filming property · ${pin.address}`;
          const value=document.createElement('span');value.textContent=`Zillow · ${priceDescription(pin.price)}`;
          tooltip.append(movies,name,address,value);record.element.replaceChildren(button,tooltip);record.signature=signature;
        }
        record.pin=pin;const position=record.marker.getLngLat();if(position.lng!==pin.coordinates[0]||position.lat!==pin.coordinates[1])record.marker.setLngLat(pin.coordinates);
        record.element.classList.toggle('selected-price',pin.placeId===selectedId);
      }
      for(const [key,record] of records)if(!active.has(key)){record.marker.remove();records.delete(key);}
      if(frame!==undefined)cancelAnimationFrame(frame);sync();
    },
    destroy(){disposed=true;if(frame!==undefined)cancelAnimationFrame(frame);map.off('move',queue);map.off('resize',queue);clear();},
  };
}

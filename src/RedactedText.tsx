import {Fragment,useId,type CSSProperties} from 'react';
import {REDACTED} from './spoilers.mjs';
import {inkAppearance,markerInk} from './marker-ink.mjs';

export function RedactedText({text}:{text?:string}){
  const id=useId();
  if(!text?.includes(REDACTED))return <>{text}</>;
  return <span className="redacted-text">{text.split(REDACTED).map((part,i)=><Fragment key={i}>{i>0&&<span className="redaction" role="img" aria-label="Redacted" style={inkAppearance(`${id}:${i}`) as CSSProperties}><span aria-hidden="true">{REDACTED}</span></span>}{part}</Fragment>)}</span>;
}

export function RedactedPhoto(){
  const id=useId();
  return <div className="photo-redaction" role="img" aria-label="Redacted" style={{...inkAppearance(id),'--redaction-ink-mid':markerInk(id+':mid'),'--redaction-ink-last':markerInk(id+':last')} as CSSProperties}/>;
}

let mapInkId=0;
export function appendRedactedText(element:HTMLElement,text:string){
  text.split(REDACTED).forEach((part,i)=>{
    if(i){const bar=document.createElement('span');bar.className='redaction';bar.setAttribute('role','img');bar.setAttribute('aria-label','Redacted');for(const [key,value] of Object.entries(inkAppearance(`map:${++mapInkId}`)))bar.style.setProperty(key,value);const ink=document.createElement('span');ink.setAttribute('aria-hidden','true');ink.textContent=REDACTED;bar.append(ink);element.append(bar);}
    element.append(document.createTextNode(part));
  });
}

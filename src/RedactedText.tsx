import {REDACTED} from './spoilers.mjs';

export function RedactedText({text}:{text?:string}){
  return <>{(text||'').split(REDACTED).map((part,i)=><span key={i}>{i>0&&<span className="redaction" role="img" aria-label="Redacted"><span aria-hidden="true">{REDACTED}</span></span>}{part}</span>)}</>;
}

export function appendRedactedText(element:HTMLElement,text:string){
  text.split(REDACTED).forEach((part,i)=>{
    if(i){const bar=document.createElement('span');bar.className='redaction';bar.setAttribute('role','img');bar.setAttribute('aria-label','Redacted');const ink=document.createElement('span');ink.setAttribute('aria-hidden','true');ink.textContent=REDACTED;bar.append(ink);element.append(bar);}
    element.append(document.createTextNode(part));
  });
}

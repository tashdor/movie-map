// Let the pointer cross the small gap into a card without leaving stale cards behind.
export function hoverPopover(open, close, timers=globalThis) {
  let pending, destroyed=false;
  const cancel=()=>{if(pending!==undefined)timers.clearTimeout(pending);pending=undefined;};
  return {
    enter(event){if(destroyed||event.pointerType==='touch'||(event.buttons&1))return;cancel();open();},
    leave(){if(destroyed)return;cancel();pending=timers.setTimeout(()=>{pending=undefined;if(!destroyed)close();},160);},
    cancel,
    destroy(){cancel();destroyed=true;close();},
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {hoverPopover} from '../src/hover-popover.mjs';
import {sideTipPlacement} from '../src/side-tip.mjs';
function clock(){
  let now=0,next=0;const pending=new Map();
  return {setTimeout(fn,ms){const id=++next;pending.set(id,{fn,at:now+ms});return id;},clearTimeout(id){pending.delete(id);},advance(ms){now+=ms;for(const [id,item] of pending)if(item.at<=now){pending.delete(id);item.fn();}}};
}

test('a hover card stays available across the icon-to-card gap, then closes after leaving both',()=>{
  const timers=clock();let open=false;const hover=hoverPopover(()=>{open=true;},()=>{open=false;},timers);
  hover.enter({pointerType:'mouse'});assert.equal(open,true);
  hover.leave();timers.advance(100);assert.equal(open,true);
  hover.enter({pointerType:'mouse'});timers.advance(200);assert.equal(open,true,'Entering the popup cancels the pending close');
  hover.leave();timers.advance(160);assert.equal(open,false,'No lingering popup after pointer departure');
});

test('touch does not open a hover card and disposal cancels queued callbacks',()=>{
  const timers=clock();let opens=0,closes=0;const hover=hoverPopover(()=>opens++,()=>closes++,timers);
  hover.enter({pointerType:'touch'});assert.equal(opens,0);
  hover.enter({pointerType:'mouse',buttons:1});assert.equal(opens,0,'Dragging the map must not open cards');
  hover.enter({pointerType:'mouse'});hover.leave();hover.destroy();
  const closed=closes;timers.advance(1000);hover.enter({pointerType:'mouse'});hover.leave();
  assert.equal(opens,1);assert.equal(closes,closed);
});

test('the setting hint sits outside the Layers menu and remains inside desktop and phone viewports',()=>{
  const anchor={top:290},menu={left:20,right:240,top:100,bottom:500};
  const desktop=sideTipPlacement(anchor,menu,{width:1200,height:800},110);
  assert.ok(desktop.left>menu.right);assert.ok(desktop.left+desktop.width<1200);
  const rightMenu={left:900,right:1120,top:100,bottom:500};
  const left=sideTipPlacement(anchor,rightMenu,{width:1200,height:800},110);
  assert.ok(left.left+left.width<rightMenu.left);
  for(const width of [320,390]){
    const phone=sideTipPlacement(anchor,menu,{width,height:844},110);
    assert.ok(phone.top>menu.bottom);assert.ok(phone.left>=12&&phone.left+phone.width<=width-12);
    assert.ok(phone.top+110<=844-12);
  }
  const tall=sideTipPlacement({top:600},{left:20,right:240,top:250,bottom:700},{width:390,height:800},110);
  assert.ok(tall.top+110<250,'When below is full, the hint fits above without covering controls');
});

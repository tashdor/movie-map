import test from 'node:test';
import assert from 'node:assert/strict';
import {fogViewportMode} from '../src/geo.mjs';
const rectangle=(left,top,right,bottom)=>[[left,top],[right,top],[right,bottom],[left,bottom],[left,top]];
test('fog skips painting only when the full feathered viewport is uniform',()=>{
  assert.equal(fogViewportMode([[rectangle(-500,-500,500,500)]],100,100),'clear');
  assert.equal(fogViewportMode([[rectangle(500,500,600,600)]],100,100),'black');
  assert.equal(fogViewportMode([[rectangle(-500,-500,200,500)]],100,100),'feathered');
  assert.equal(fogViewportMode([[rectangle(-500,-500,200,500)]],100,100,0),'clear');
});
test('boundary crossings and interior islands or holes retain their actual mask',()=>{
  assert.equal(fogViewportMode([[rectangle(-500,-500,50,500)]],100,100,0),'feathered');
  assert.equal(fogViewportMode([[rectangle(10,10,20,20)]],100,100,0),'feathered');
  assert.equal(fogViewportMode([[rectangle(-500,-500,500,500),rectangle(10,10,20,20)]],100,100,0),'feathered');
  assert.equal(fogViewportMode([[rectangle(-500,-500,500,500),rectangle(-200,-200,300,300)]],100,100,0),'black');
});

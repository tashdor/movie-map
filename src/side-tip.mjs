export function sideTipPlacement(anchor,menu,viewport,height=110){
  const gap=10,margin=12,preferred=260;
  const right=viewport.width-menu.right-gap-margin,left=menu.left-gap-margin;
  if(Math.max(right,left)>=180){
    const useRight=right>=180,width=Math.min(preferred,useRight?right:left);
    return {width,left:useRight?menu.right+gap:menu.left-gap-width,top:Math.max(margin,Math.min(anchor.top,viewport.height-height-margin))};
  }
  // A phone may have no room beside the menu; keep the hint outside its controls.
  const width=Math.min(preferred,viewport.width-margin*2);
  const below=viewport.height-menu.bottom-gap-margin;
  return {width,left:Math.max(margin,Math.min(menu.left,viewport.width-width-margin)),top:below>=height?menu.bottom+gap:Math.max(margin,menu.top-gap-height)};
}

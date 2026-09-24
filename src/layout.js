export function layout(items, settings) {
  const count = [1,2,4].includes(+settings.count) ? +settings.count : 2;
  let [width,height] = settings.paper === 'letter' ? [215.9,279.4] : [210,297];
  if(settings.orientation === 'landscape') [width,height]=[height,width];
  const cols=count===4?2:count===2&&width>height?2:1, rows=count/cols;
  const margin=Math.max(0,Math.min(25,+settings.margin||0)), gap=Math.max(0,Math.min(20,+settings.gap||0));
  const sw=(width-margin*2-gap*(cols-1))/cols, sh=(height-margin*2-gap*(rows-1))/rows;
  const copies=Math.max(1,Math.min(20,+settings.copies||1));
  let queue=settings.repeat==='set'?Array.from({length:copies},()=>items).flat():items.flatMap(i=>Array(copies).fill(i));
  if(settings.fillLast&&queue.length) while(queue.length%count)queue.push(queue.at(-1));
  const pages=[];
  for(let p=0;p<queue.length;p+=count) pages.push(queue.slice(p,p+count).map((item,i)=>({item,x:margin+(i%cols)*(sw+gap),y:margin+Math.floor(i/cols)*(sh+gap),width:sw,height:sh})));
  return {width,height,cols,rows,margin,gap,pages};
}
export function placement(w,h,rotation,slot,fit='contain') {
  const r=((rotation%360)+360)%360, rotated=r%180!==0;
  const ew=rotated?h:w, eh=rotated?w:h;
  const scale=(fit==='cover'?Math.max:Math.min)(slot.width/ew,slot.height/eh);
  return {x:slot.x+(slot.width-ew*scale)/2,y:slot.y+(slot.height-eh*scale)/2,width:ew*scale,height:eh*scale,rawWidth:w*scale,rawHeight:h*scale,rotation:r};
}

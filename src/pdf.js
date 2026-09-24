import {layout,placement} from './layout.js';
const MM=72/25.4;
export async function createPDF(items,settings,progress=()=>{}) {
 const L=window.PDFLib, doc=await L.PDFDocument.create(), plan=layout(items,settings), cache=new Map();
 if(plan.pages.length>200)throw new Error('exportLimit');
 doc.setTitle('Print-ready pages');doc.setCreator('Image to PDF');
 for(let n=0;n<plan.pages.length;n++){
  const page=doc.addPage([plan.width*MM,plan.height*MM]);
  for(const slot of plan.pages[n]){
   const item=slot.item;
   if(!cache.has(item.id)){
    if(item.kind==='pdf'){
     // Normalize the visible crop box into an embedded form; preserve vector artwork.
     const src=item.source.lib.getPage(item.pageIndex),box=src.getCropBox();
     const embedded=await doc.embedPage(src,{left:box.x,bottom:box.y,right:box.x+box.width,top:box.y+box.height});
     cache.set(item.id,{embedded,w:box.width,h:box.height,rotation:src.getRotation().angle});
    }else{
     const embedded=item.mime==='image/jpeg'?await doc.embedJpg(item.bytes):await doc.embedPng(item.bytes);
     cache.set(item.id,{embedded,w:embedded.width,h:embedded.height,rotation:0});
    }
   }
   const c=cache.get(item.id),p=placement(c.w,c.h,c.rotation+item.rotation,slot,settings.fit);
   const left=p.x*MM,bottom=(plan.height-p.y-p.height)*MM;
   let x=left,y=bottom;
   if(p.rotation===90)y+=p.height*MM;
   if(p.rotation===180){x+=p.width*MM;y+=p.height*MM;}
   if(p.rotation===270)x+=p.width*MM;
   page.pushOperators(L.pushGraphicsState(),L.rectangle(slot.x*MM,(plan.height-slot.y-slot.height)*MM,slot.width*MM,slot.height*MM),L.clip(),L.endPath());
   const options={x,y,width:p.rawWidth*MM,height:p.rawHeight*MM,rotate:L.degrees(-p.rotation)};
   item.kind==='pdf'?page.drawPage(c.embedded,options):page.drawImage(c.embedded,options);
   page.pushOperators(L.popGraphicsState());
  }
  if(settings.cut){
   const o={thickness:.35,color:L.rgb(.65,.7,.73),dashArray:[3,3]};
   if(plan.cols>1)page.drawLine({...o,start:{x:plan.width*MM/2,y:plan.margin*MM},end:{x:plan.width*MM/2,y:(plan.height-plan.margin)*MM}});
   if(plan.rows>1)page.drawLine({...o,start:{x:plan.margin*MM,y:plan.height*MM/2},end:{x:(plan.width-plan.margin)*MM,y:plan.height*MM/2}});
  }
  progress(n+1,plan.pages.length);await new Promise(r=>setTimeout(r,0));
 }
 return new Blob([await doc.save()],{type:'application/pdf'});
}

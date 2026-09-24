import {messages} from './i18n.js';
import {layout,placement} from './layout.js';
import {icon} from './template.js';
import {createPDF} from './pdf.js';
const $=id=>document.getElementById(id);
let lang=document.documentElement.lang==='ko'?'ko':'en', t=messages[lang], items=[], busy=false, currentPage=0, count=2, cached=null, toastTimer, previewVersion=0, sourceBytes=0;
const settings=()=>({count,paper:$('paper').value,orientation:$('orientation').value,margin:+$('margin').value,gap:+$('gap').value,copies:Math.max(1,Math.min(20,Math.floor(+$('copies').value)||1)),repeat:$('repeat').value,fit:$('fit').value,fillLast:$('fillLast').checked,cut:$('cut').checked});
let pdfjsPromise;
const pdfjs=()=>pdfjsPromise??=import('/vendor/pdf.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs';return lib;});
function notify(text){$('notification').textContent=text;$('notification').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('notification').hidden=true,7000);}
function setBusy(value,label='',done=0,total=1){busy=value;$('busy').hidden=!value;$('busy-text').textContent=label;$('progress').value=total?done/total*100:0;}
function metadata(){document.documentElement.lang=lang;document.title=t.title;document.querySelector('meta[name=description]').content=t.description;document.querySelector('link[rel=canonical]').href=location.origin+'/'+lang+'/';document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t[e.dataset.i18n]);document.querySelectorAll('[data-lang]').forEach(e=>{e.removeAttribute('aria-current');if(e.dataset.lang===lang)e.setAttribute('aria-current','true');});for(const [id,key]of [['zoom','zoom'],['prev','prev'],['next','next']]){$(id).setAttribute('aria-label',t[key]);$(id).title=t[key];}document.querySelector('.layouts').setAttribute('aria-label',t.layout);document.querySelector('.brand').href='/'+lang+'/';$('zoom-image').alt=t.preview;}
function setLanguage(next,remember=false){lang=next;t=messages[lang];if(remember){try{localStorage.setItem('print-language',lang);}catch{}document.cookie=`print-language=${lang};path=/;max-age=31536000;SameSite=Lax;Secure`;}history.replaceState(null,'','/'+lang+'/');metadata();if(cached)$('share').querySelector('span').textContent=t.share;renderCards();update();}
document.querySelectorAll('[data-lang]').forEach(a=>a.onclick=e=>{e.preventDefault();setLanguage(a.dataset.lang,true);});
window.addEventListener('popstate',()=>setLanguage(location.pathname.startsWith('/ko')?'ko':'en'));
async function imageFrom(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('failed'));img.src=url;});}
async function canvasBlob(canvas,type='image/png'){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('failed')),type,.94));}
async function readImage(file){
 const url=URL.createObjectURL(file);let img;try{img=await imageFrom(url);}catch(e){URL.revokeObjectURL(url);throw e;}
 let w=img.naturalWidth,h=img.naturalHeight;if(!w||!h||w*h>100000000){URL.revokeObjectURL(url);throw new Error('limit');}
 const ratio=Math.min(1,5000/Math.max(w,h),Math.sqrt(18000000/(w*h)));w=Math.round(w*ratio);h=Math.round(h*ratio);
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(img,0,0,w,h);
 const mime=file.type==='image/jpeg'?'image/jpeg':'image/png', blob=await canvasBlob(cv,mime),bytes=new Uint8Array(await blob.arrayBuffer());
 URL.revokeObjectURL(url);cv.width=0;cv.height=0;
 const thumb=document.createElement('canvas');thumb.width=Math.max(1,Math.round(w*Math.min(1,650/w,650/h)));thumb.height=Math.max(1,Math.round(h*Math.min(1,650/w,650/h)));
 const normalizedUrl=URL.createObjectURL(blob),normalized=await imageFrom(normalizedUrl);thumb.getContext('2d').drawImage(normalized,0,0,thumb.width,thumb.height);const thumbUrl=URL.createObjectURL(await canvasBlob(thumb));URL.revokeObjectURL(normalizedUrl);
 if(ratio<1)notify(t.reduced);
 return {id:crypto.randomUUID(),kind:'image',name:file.name,rotation:0,width:w,height:h,bytes,mime,thumbUrl,preview:await imageFrom(thumbUrl)};
}
async function readPDF(file){
 const bytes=new Uint8Array(await file.arrayBuffer()),lib=await window.PDFLib.PDFDocument.load(bytes),engine=await pdfjs();
 const task=engine.getDocument({data:bytes.slice(),isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/'});task.onPassword=()=>{void task.destroy();};
 const pdf=await task.promise;if(items.length+pdf.numPages>80){await pdf.destroy();throw new Error('limit');}
 const source={lib,pdf},pending=[];
 try{for(let i=0;i<pdf.numPages;i++){
  setBusy(true,`${t.loading} · ${file.name} (${i+1}/${pdf.numPages})`,i,pdf.numPages);
  const page=await pdf.getPage(i+1),v=page.getViewport({scale:1}),view=page.getViewport({scale:650/Math.max(v.width,v.height)}),canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
  await page.render({canvasContext:canvas.getContext('2d'),viewport:view,background:'white'}).promise;
  const thumbUrl=URL.createObjectURL(await canvasBlob(canvas));pending.push({id:crypto.randomUUID(),kind:'pdf',name:`${file.name} · ${i+1}`,rotation:0,source,pageIndex:i,width:v.width,height:v.height,thumbUrl,preview:await imageFrom(thumbUrl)});page.cleanup();canvas.width=0;canvas.height=0;
 }}catch(e){pending.forEach(i=>URL.revokeObjectURL(i.thumbUrl));await pdf.destroy();throw e;}return pending;
}
async function addFiles(files){if(busy||!files.length)return;setBusy(true,t.loading);let errors=[];
 try{for(const file of files){try{
  if(items.length>=80||file.size>30*1024*1024||sourceBytes+file.size>150*1024*1024)throw new Error('limit');
  if(/\.pdf$/i.test(file.name)||file.type==='application/pdf')items.push(...await readPDF(file));
  else if(/^image\/(jpeg|png|webp)$/.test(file.type)||/\.(jpe?g|png|webp)$/i.test(file.name))items.push(await readImage(file));
  else throw new Error('unsupported');sourceBytes+=file.size;
 }catch(e){errors.push(`${file.name}: ${t[e.message]||t.failed}`);}}
 }finally{setBusy(false);$('file-input').value='';invalidate();renderCards();update();if(errors.length)notify(errors.join('\n'));}}
function invalidate(){cached=null;$('export-status').textContent='';$('share').querySelector('span').textContent=t.prepare;}
function reorder(from,to){if(from===to||to<0||to>=items.length)return;items.splice(to,0,items.splice(from,1)[0]);invalidate();renderCards();update();}
function renderCards(){const list=$('file-list');list.replaceChildren();items.forEach((item,i)=>{
 const card=document.createElement('article');card.className='file-card';card.dataset.index=i;
 const thumb=document.createElement('div');thumb.className='thumb';const img=document.createElement('img');img.src=item.thumbUrl;img.alt=item.name;img.style.transform=`rotate(${item.rotation}deg) scale(${item.rotation%180?.76:1})`;thumb.append(img);card.append(thumb);
 const num=document.createElement('span');num.className='card-number';num.textContent=i+1;card.append(num);
 const name=document.createElement('p');name.className='file-name';name.textContent=item.name;name.title=item.name;card.append(name);
 const actions=document.createElement('div');actions.className='card-actions';
 for(const [key,ico,handler]of [['rotate','rotate',()=>{item.rotation=(item.rotation+90)%360;invalidate();renderCards();update();}],['up','up',()=>reorder(i,i-1)],['down','down',()=>reorder(i,i+1)],['remove','delete',()=>{URL.revokeObjectURL(item.thumbUrl);items.splice(i,1);if(item.source&&!items.some(x=>x.source===item.source))item.source.pdf.destroy();if(!items.length)sourceBytes=0;invalidate();renderCards();update();}]]){
 const b=document.createElement('button');b.className=`icon-button ${key}`;b.title=t[key];b.setAttribute('aria-label',`${t[key]} · ${i+1}`);b.innerHTML=icon(ico)+(key==='rotate'?`<small>${t.rotate}</small>`:'');b.onclick=handler;b.disabled=(key==='up'&&i===0)||(key==='down'&&i===items.length-1);actions.append(b);
 }card.append(actions);
 const handle=document.createElement('button');handle.className='drag-handle';handle.innerHTML=icon('grip');handle.setAttribute('aria-label',`${t.reorder} · ${i+1}`);handle.title=t.reorder;
 handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();handle.setPointerCapture(e.pointerId);card.classList.add('dragging');};
 handle.onpointerup=e=>{card.classList.remove('dragging');const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.file-card');if(target)reorder(i,+target.dataset.index);};handle.onpointercancel=()=>card.classList.remove('dragging');card.append(handle);list.append(card);
 });$('file-count').textContent=items.length;$('clear').hidden=!items.length;}
function update(){const s=settings(),plan=layout(items,s);currentPage=Math.min(currentPage,Math.max(0,plan.pages.length-1));$('margin-value').textContent=s.margin+' mm';$('gap-value').textContent=s.gap+' mm';$('crop-hint').hidden=s.fit!=='cover';$('save').disabled=$('share').disabled=!items.length;$('zoom').disabled=!items.length;$('prev').disabled=currentPage===0;$('next').disabled=currentPage>=plan.pages.length-1;$('page-status').textContent=items.length?`${currentPage+1} / ${plan.pages.length} · ${s.paper.toUpperCase()}`:'—';$('preview-empty').hidden=!!items.length;$('preview-canvas').hidden=!items.length;drawPreview(plan,s);}
async function drawPreview(plan,s){const version=++previewVersion;if(!plan.pages.length)return;const canvas=$('preview-canvas'),scale=2.8;canvas.width=Math.round(plan.width*scale);canvas.height=Math.round(plan.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(const slot of plan.pages[currentPage]){if(version!==previewVersion)return;const item=slot.item,p=placement(item.width,item.height,item.rotation,slot,s.fit);ctx.save();ctx.scale(scale,scale);ctx.beginPath();ctx.rect(slot.x,slot.y,slot.width,slot.height);ctx.clip();ctx.translate(p.x+p.width/2,p.y+p.height/2);ctx.rotate(item.rotation*Math.PI/180);ctx.drawImage(item.preview,-p.rawWidth/2,-p.rawHeight/2,p.rawWidth,p.rawHeight);ctx.restore();}
 if(s.cut){ctx.save();ctx.scale(scale,scale);ctx.strokeStyle='#a6b2ba';ctx.lineWidth=.15;ctx.setLineDash([1,1]);ctx.beginPath();if(plan.cols>1){ctx.moveTo(plan.width/2,plan.margin);ctx.lineTo(plan.width/2,plan.height-plan.margin);}if(plan.rows>1){ctx.moveTo(plan.margin,plan.height/2);ctx.lineTo(plan.width-plan.margin,plan.height/2);}ctx.stroke();ctx.restore();}}
$('drop-zone').onclick=()=>$('file-input').click();$('file-input').onchange=e=>addFiles([...e.target.files]);$('drop-zone').ondragover=e=>{e.preventDefault();$('drop-zone').classList.add('dragover');};$('drop-zone').ondragleave=()=>$('drop-zone').classList.remove('dragover');$('drop-zone').ondrop=e=>{e.preventDefault();$('drop-zone').classList.remove('dragover');addFiles([...e.dataTransfer.files]);};document.addEventListener('paste',e=>{if(e.clipboardData.files.length){e.preventDefault();addFiles([...e.clipboardData.files]);}});
$('settings').oninput=()=>{invalidate();update();};$('copies').onchange=()=>{$('copies').value=settings().copies;update();};document.querySelectorAll('[data-count]').forEach(b=>b.onclick=()=>{count=+b.dataset.count;document.querySelectorAll('[data-count]').forEach(a=>{a.classList.toggle('selected',a===b);a.setAttribute('aria-pressed',a===b);});invalidate();update();});
$('prev').onclick=()=>{currentPage--;update();};$('next').onclick=()=>{currentPage++;update();};$('zoom').onclick=()=>{$('zoom-image').src=$('preview-canvas').toDataURL();$('zoom-dialog').showModal();};$('close-zoom').onclick=()=>$('zoom-dialog').close();$('clear').onclick=()=>$('clear-dialog').showModal();$('cancel-clear').onclick=()=>$('clear-dialog').close();$('confirm-clear').onclick=()=>{items.forEach(i=>URL.revokeObjectURL(i.thumbUrl));new Set(items.filter(i=>i.source).map(i=>i.source.pdf)).forEach(p=>p.destroy());items=[];sourceBytes=0;invalidate();renderCards();update();$('clear-dialog').close();};
const filename=()=>($('filename').value.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/\.pdf$/i,'')||'coloring-pages')+'.pdf';
async function prepare(){if(cached)return cached;setBusy(true,t.generating);try{cached=await createPDF(items,settings(),(d,total)=>setBusy(true,`${t.generating} · ${d}/${total}`,d,total));$('share').querySelector('span').textContent=t.share;return cached;}finally{setBusy(false);}}
function download(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);notify(t.downloaded);track('download');}
function track(action){window.va?.('event',{name:'core_action',data:{action,layout:count}});}
$('save').onclick=async()=>{if(busy||!items.length)return;try{download(await prepare());}catch(e){notify(t[e.message]||t.error);}};
$('share').onclick=async()=>{if(busy||!items.length)return;try{
 if(!cached){await prepare();$('share').querySelector('span').textContent=t.share;$('export-status').textContent=t.ready;return;}
 const file=new File([cached],filename(),{type:'application/pdf'});
 if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Image to PDF'});notify(t.shared);track('share');}
 else{download(cached);$('export-status').textContent=t.fallback;}
 }catch(e){if(e.name!=='AbortError')notify(t[e.message]||t.error);}};
window.visualViewport?.addEventListener('resize',()=>document.body.classList.toggle('keyboard-open',window.visualViewport.height<window.innerHeight*.75));
renderCards();update();

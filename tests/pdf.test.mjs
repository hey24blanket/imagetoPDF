import test from 'node:test';import assert from 'node:assert/strict';import * as L from 'pdf-lib';import {createPDF} from '../src/pdf.js';
global.window={PDFLib:L};
test('mixed image/vector PDF export preserves vector text and physical size',async()=>{
 const source=await L.PDFDocument.create();const p=source.addPage([200,300]);p.drawText('VECTOR TEXT',{x:20,y:270,size:14});p.drawRectangle({x:20,y:20,width:40,height:70,color:L.rgb(1,0,0)});p.setRotation(L.degrees(90));
 const image={id:'image',kind:'image',mime:'image/png',bytes:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAYAAAAJCAIAAACe+MrKAAAAFUlEQVR4nGP8//8/AypgYsAAg0IIAP/CAw/mOQ9EAAAAAElFTkSuQmCC','base64'),rotation:90};const vector={id:'pdf',kind:'pdf',source:{lib:source},pageIndex:0,rotation:90};
 const blob=await createPDF([image,vector],{count:2,paper:'a4',orientation:'landscape',margin:5,gap:4,copies:1,fit:'contain'});const bytes=new Uint8Array(await blob.arrayBuffer());const output=await L.PDFDocument.load(bytes);assert.equal(output.getPageCount(),1);assert.ok(Math.abs(output.getPage(0).getWidth()-297*72/25.4)<.01);
});

import type {DemoTripReceipt} from './tripReceiptDemo';
const money=(n:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n/100);
function pdfText(text:string){return text.replace(/[–—−]/g,'-').replace(/[^\x20-\xff]/g,'?').replace(/[()\\]|[^\x20-\x7e]/g,c=>`\\${c.charCodeAt(0).toString(8).padStart(3,'0')}`);}
export function receiptPdfLines(r:DemoTripReceipt,role:'owner'|'driver'){
 const lines=[`Comprobante: ${r.id}`,`Recorrido: ${r.tripName}`,`Empresa: ${r.company}`,`Repartidor: ${r.driver}`,`Fecha del reparto: ${r.date}`,`Cierre: ${new Date(r.closedAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hourCycle:'h23'})}`,'','EFECTIVO A RENDIR',money(r.cash),'Cobros en efectivo del reparto, incluidos saldos anteriores.','No confirma que el dinero haya sido recibido por el jefe.'];
 if(role==='owner')lines.push('','VENTAS Y COBROS',`Ventas registradas: ${money(r.sold)}`,`Cobrado en efectivo: ${money(r.cash)}`,`Cobrado por transferencia: ${money(r.transfer)}`,`Total cobrado: ${money(r.cash+r.transfer)}`,'Venta y cobro son importes distintos; puede haber deuda pendiente.');
 lines.push('','CARGA INICIAL Y REGRESO');
 for(const p of r.stock)lines.push(p.name,`Carga inicial: ${p.initial} | Llenos/unidades que vuelven: ${p.returnedFull}`,`Envases vacios que vuelven: ${p.returnedEmpty} | Dispenser nuevos entregados: ${p.dispensersDelivered}`,'');
 lines.push('DISPENSER CAMBIADOS Y RETIRADOS');
 if(!r.changes.length)lines.push('Sin cambios de dispenser registrados.');
 for(const c of r.changes)lines.push(`Retirado: ${c.previous}`,`Reemplazo entregado: ${c.replacement}`,`Estado retirado: ${c.condition}`,'');
 lines.push('OBSERVACIONES',r.note||'Sin observaciones.','','DEMO - Datos ficticios. Comprobante interno de rendicion.');
 return lines;
}
export function createTripReceiptPdf(r:DemoTripReceipt,role:'owner'|'driver'):Uint8Array{
 const wrapped=receiptPdfLines(r,role).flatMap(line=>{const result:string[]=[];let text=line;while(text.length>90){let split=text.lastIndexOf(' ',90);if(split<20)split=90;result.push(text.slice(0,split));text=text.slice(split).trimStart();}result.push(text);return result;});
 const pages:string[][]=[];for(let i=0;i<wrapped.length;i+=41)pages.push(wrapped.slice(i,i+41));
 const objects:string[]=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 const kids:number[]=[];
 for(const [index,lines] of pages.entries()){
  const pageId=objects.length; kids.push(pageId);const streamId=pageId+1;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
  let commands='0.04 0.48 0.57 rg 30 772 535 44 re f\nBT /F2 16 Tf 1 1 1 rg 44 789 Td (HidroTrack - Cierre de reparto) Tj ET\n';
  for(const [i,line] of lines.entries())commands+=`BT /F1 9 Tf 0.08 0.24 0.32 rg 44 ${744-i*15} Td (${pdfText(line)}) Tj ET\n`;
  commands+=`BT /F1 8 Tf 0.2 0.4 0.5 rg 44 44 Td (${pdfText(`${role==='owner'?'Copia del jefe':'Copia del asistente'} - DEMO - Pagina ${index+1} de ${pages.length}`)}) Tj ET\n`;
  objects.push(`<< /Length ${commands.length} >>\nstream\n${commands}endstream`);
 }
 objects[2]=`<< /Type /Pages /Kids [${kids.map(id=>`${id} 0 R`).join(' ')}] /Count ${kids.length} >>`;
 let out='%PDF-1.4\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(out.length);out+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
 const start=out.length;out+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
 return Uint8Array.from(out,c=>c.charCodeAt(0));
}
export function downloadTripReceipt(r:DemoTripReceipt,role:'owner'|'driver'){
 const bytes=createTripReceiptPdf(r,role),blob=new Blob([bytes as BlobPart],{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`hidrotrack-${r.tripId}-${role}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

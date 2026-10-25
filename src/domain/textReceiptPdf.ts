function pdfText(text:string){return text.replace(/[–—−]/g,'-').replace(/[^\x20-\xff]/g,'?').replace(/[()\\]|[^\x20-\x7e]/g,c=>`\\${c.charCodeAt(0).toString(8).padStart(3,'0')}`);}

/** Self-contained A4 PDF. All content is escaped and encoded with WinAnsi fonts. */
export function createTextReceiptPdf(lines:string[],footer:string):Uint8Array{
 const wrapped=lines.flatMap(line=>{const result:string[]=[];let text=line.replace(/[\r\n\t]/g,' ');while(text.length>90){let split=text.lastIndexOf(' ',90);if(split<20)split=90;result.push(text.slice(0,split));text=text.slice(split).trimStart();}result.push(text);return result;});
 const heading=(line:string)=>/[A-ZÁÉÍÓÚÑ]/.test(line)&&/^[A-ZÁÉÍÓÚÑ ·/]+$/.test(line);
 const pages:string[][]=[];for(let i=0;i<wrapped.length;){let end=Math.min(i+41,wrapped.length);if(end<wrapped.length){for(let j=Math.max(i,end-2);j<end;j++){if(heading(wrapped[j])){end=j;break;}}}pages.push(wrapped.slice(i,end));i=end;}
 if(!pages.length)pages.push([]);
 const objects:string[]=['','<< /Type /Catalog /Pages 2 0 R >>','','<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 const kids:number[]=[];
 for(const [index,page] of pages.entries()){
  const pageId=objects.length;kids.push(pageId);const streamId=pageId+1;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
  let commands='0.85 0.95 0.99 rg 30 772 535 44 re f\nBT /F2 16 Tf 0.04 0.42 0.53 rg 44 789 Td (HidroTrack - Cierre de reparto) Tj ET\n';
  for(const [i,line] of page.entries())commands+=`BT /F1 9 Tf 0.08 0.24 0.32 rg 44 ${744-i*15} Td (${pdfText(line)}) Tj ET\n`;
  commands+=`BT /F1 8 Tf 0.2 0.4 0.5 rg 44 44 Td (${pdfText(`${footer} - Pagina ${index+1} de ${pages.length}`)}) Tj ET\n`;
  objects.push(`<< /Length ${commands.length} >>\nstream\n${commands}endstream`);
 }
 objects[2]=`<< /Type /Pages /Kids [${kids.map(id=>`${id} 0 R`).join(' ')}] /Count ${kids.length} >>`;
 let out='%PDF-1.4\n';const offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(out.length);out+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
 const start=out.length;out+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
 return Uint8Array.from(out,c=>c.charCodeAt(0));
}

export function downloadPdf(bytes:Uint8Array,filename:string){
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/pdf'})),link=document.createElement('a');
 try{link.href=url;link.download=filename;document.body.appendChild(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
}

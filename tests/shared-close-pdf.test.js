import {expect,it} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {sharedCloseReceiptLines,createSharedClosePdf} from '../src/domain/sharedCloseReceiptPdf';
const h={id:'cierre-ficticio',tenant_id:'empresa-ficticia',company:'Agua de prueba',driver:'Lucía de prueba',trip:{id:'ruta-ficticia',name:'Centro - Prueba ficticia',date:'2026-10-25',status:'closed'},closed_at:'2026-10-25T19:00:00Z',closure_state:'approved',declared_cash:8300.25,declared_transfer:3500.5,sales:7000,initial_load:[{product_id:'p',name:'Bidón 20 litros',loaded:30},{product_id:'d',name:'Dispenser frío/calor',loaded:2}],stock:[{product_id:'p',name:'Bidón 20 litros',family:'article',ready:10,empties:20},{product_id:'d',name:'Dispenser frío/calor',family:'dispenser',ready:1,empties:0}],declared_stock:[{product_id:'p',ready:10,empties:20},{product_id:'d',ready:1,empties:0}],note:'Conteo revisado (sin diferencias).',decision_note:'Recibido y aprobado.'};
it('copias reales distinguen efectivo de ventas y transferencias sin multiplicar pesos por cien',()=>{
 const owner=sharedCloseReceiptLines(h,'owner').join('\n'),driver=sharedCloseReceiptLines(h,'driver').join('\n');expect(owner).toContain('11.800,75');expect(owner).toContain('7.000,00');expect(driver).toContain('8.300,25');expect(driver).not.toContain('3.500,50');expect(driver).not.toContain('VENTAS Y COBROS');expect(driver).toContain('16:00:00');expect(driver).toContain('Bidón 20 litros: 30');expect(driver).toContain('Vacíos: 20');expect(driver).not.toContain('DEMO');
 mkdirSync('output/pdf',{recursive:true});for(const role of ['owner','driver'])writeFileSync(`output/pdf/cierre-compartido-${role}-prueba.pdf`,createSharedClosePdf(h,role));
});
it('copia del asistente se genera con respuesta sin ventas ni transferencias',()=>{
 const {sales,declared_transfer,...driver}=h;expect(()=>createSharedClosePdf(driver,'driver')).not.toThrow();expect(()=>createSharedClosePdf(driver,'owner')).toThrow();for(const patch of [{closure_state:'submitted'},{closed_at:null},{declared_cash:NaN},{stock:[{...h.stock[0],ready:100}]}])expect(()=>createSharedClosePdf({...h,...patch},'driver')).toThrow();
});
it('pagina nombres extensos y escapa los caracteres del formato PDF',()=>{
 const long={...h,stock:Array.from({length:70},(_,i)=>({...h.stock[0],product_id:`p${i}`,name:`Artículo ${i} (lote) \\ `+'nombre extenso '.repeat(10)})),declared_stock:Array.from({length:70},(_,i)=>({product_id:`p${i}`,ready:10,empties:20}))};const bytes=createSharedClosePdf(long,'driver'),text=new TextDecoder().decode(bytes);expect(text).toContain('\\050lote\\051');expect((text.match(/\/Type \/Page /g)||[]).length).toBeGreaterThan(2);mkdirSync('tmp/pdfs',{recursive:true});writeFileSync('tmp/pdfs/cierre-compartido-largo.pdf',bytes);
});

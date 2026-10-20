import {describe,it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {approveClose,closeTrip,recordVisit,seedProgram} from '../src/domain/programDemo';
import {createTripReceiptPdf,receiptPdfLines} from '../src/domain/tripReceiptPdf';
const receipt={id:'CIERRE-DEMO-1',tripId:'demo-1',tripName:'Centro - Reparto 1',company:'Agua Clara',driver:'Lucía Medina',date:'2026-10-19',closedAt:'2026-10-19T19:00:00Z',cash:4700000,transfer:2300000,sold:7000000,stock:[{name:'Bidón 20 litros',initial:30,returnedFull:10,returnedEmpty:20,dispensersDelivered:0},{name:'Dispenser frío/calor',initial:2,returnedFull:1,returnedEmpty:0,dispensersDelivered:0}],changes:[{previous:'FC-021',replacement:'FC-034',condition:'Con daño - revisión'}],note:'Retirado con pérdida de agua. Dejar en revisión.'};
describe('comprobante PDF de cierre',()=>{
 it('efectivo a rendir incluye deuda cobrada, y transferencia no se suma a efectivo',()=>{
  let s=recordVisit(seedProgram(),{tripId:'t1',clientId:'c1',actorId:'luz',items:[{productId:'b20',quantity:1,returned:0}],paid:'8300',method:'Efectivo'});
  s=recordVisit(s,{tripId:'t1',clientId:'c2',actorId:'luz',items:[{productId:'b20',quantity:1,returned:0}],paid:'3500',method:'Transferencia'});
  s.trips[0].stops.forEach(p=>{p.status='visited';});const closed=approveClose(closeTrip(s,'t1',s.trips[0].stock,''),'t1');
  expect(closed.trips[0].receipt).toMatchObject({cash:830000,transfer:350000,sold:700000});
 });
 it('crea copia del jefe y del asistente sin exponer totales del jefe en la segunda',()=>{
  const owner=receiptPdfLines(receipt,'owner').join('\n'),driver=receiptPdfLines(receipt,'driver').join('\n');
  expect(owner).toContain('Cobrado por transferencia');expect(owner).toContain('16:00:00');expect(driver).not.toContain('VENTAS Y COBROS');expect(driver).toContain('EFECTIVO A RENDIR');expect(driver).toContain('FC-021');
  const bytes=createTripReceiptPdf(receipt,'owner'),text=new TextDecoder().decode(bytes);expect(text.startsWith('%PDF-1.4')).toBe(true);expect(text).toContain('startxref');
  mkdirSync('output/pdf',{recursive:true});writeFileSync('output/pdf/cierre-reparto-demo.pdf',bytes);
 });
 it('pagina nombres extensos y escapa caracteres del formato PDF',()=>{
  const long={...receipt,company:'Prueba (nombre) \\ empresa',stock:Array.from({length:70},(_,i)=>({...receipt.stock[0],name:`Articulo ${i} `+'nombre extenso '.repeat(10)}))};
  const text=new TextDecoder().decode(createTripReceiptPdf(long,'owner'));expect(text).toContain('\\050nombre\\051');expect((text.match(/\/Type \/Page /g)||[]).length).toBeGreaterThan(1);
  mkdirSync('tmp/pdfs',{recursive:true});writeFileSync('tmp/pdfs/cierre-largo.pdf',createTripReceiptPdf(long,'owner'));
 });
 it('congela al aprobar, no duplica regreso y no reconstruye historia con precios nuevos',()=>{
  const s=seedProgram();s.trips[0].stops.forEach(p=>{p.status='visited';});
  const closed=approveClose(closeTrip(s,'t1',s.trips[0].stock,''),'t1');expect(closed.trips[0].receipt?.stock[0].initial).toBe(40);
  closed.company.name='Otra empresa';closed.products[0].name='Nombre cambiado';expect(closed.trips[0].receipt?.company).toBe('Agua Clara');expect(closed.trips[0].receipt?.stock[0].name).toBe('Bidón 20 litros');
  expect(()=>approveClose(closed,'t1')).toThrow('pendiente');
 });
});

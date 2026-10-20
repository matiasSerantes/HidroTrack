import { deliveryDate } from './route';
import { exampleAssets, type CustomerAsset } from './customerAssets';
export type Customer = { id: string; name: string; address: string; phone: string; days: string; quantity: number; active?: boolean; notes?: string; assignedTo?: 'owner' | 'driver'; lat?: number; lng?: number; city?: string; neighborhood?: string; assets?: CustomerAsset[] };
export type Delivery = { createdAt?: string; id: string; customerId: string; quantity: number; returned: number; amountCents: number; paidCents: number; method: 'Efectivo' | 'Transferencia' | 'Cuenta corriente' };
export type DemoState = { customers: Customer[]; order: string[]; deliveries: Delivery[]; locationVersion?: number; routeVersion?: number };
export const initialState: DemoState = {
  customers: [
    { id: 'maria', assets: exampleAssets('maria'), lat: -34.6037, lng: -58.3816, city: 'Buenos Aires', name: 'María González', address: 'San Martín 123', phone: '11 5555 0101', days: 'Lun · Jue', quantity: 2 },
    { id: 'carlos', lat: -34.6082, lng: -58.3925, city: 'Buenos Aires', name: 'Carlos López', address: 'Av. Belgrano 456', phone: '11 5555 0102', days: 'Mar · Vie', quantity: 1 },
    { id: 'ana', assets: exampleAssets('ana'), lat: -34.612, lng: -58.3845, city: 'Buenos Aires', name: 'Ana Fernández', address: 'Rivadavia 789', phone: '11 5555 0103', days: 'Mié · Sáb', quantity: 3 },
    { id: 'jorge', lat: -34.599, lng: -58.394, city: 'Buenos Aires', name: 'Jorge Ramírez', address: 'Mitre 240', phone: '11 5555 0104', days: 'Lun · Jue', quantity: 2 },
    { id: 'lucia', lat: -34.61205, lng: -58.38455, city: 'Buenos Aires', name: 'Lucía Pérez', address: 'Rivadavia 795', phone: '11 5555 0105', days: 'Mié · Sáb', quantity: 1 },
    { id: 'kiosco', lat: -34.612, lng: -58.3845, city: 'Buenos Aires', name: 'Kiosco de Pablo', address: 'Rivadavia 789 · Local 2', phone: '11 5555 0106', days: 'Mié · Sáb', quantity: 4 },
  ], order: ['maria', 'carlos', 'ana', 'jorge', 'lucia', 'kiosco'], deliveries: [],
};
export const currency = (cents: number) => (cents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });
export function totals(deliveries: Delivery[]) {
  return deliveries.reduce((a, d) => ({ units: a.units + d.quantity, returned: a.returned + d.returned, sales: a.sales + d.amountCents, cash: a.cash + (d.method === 'Efectivo' ? d.paidCents : 0), transfers: a.transfers + (d.method === 'Transferencia' ? d.paidCents : 0), debt: a.debt + d.amountCents - d.paidCents }), { units: 0, returned: 0, sales: 0, cash: 0, transfers: 0, debt: 0 });
}
export function parseMoney(value: string) {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error('Ingresá un importe válido con hasta dos decimales.');
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('El importe es demasiado grande.');
  return cents;
}
export function validateDelivery(d: Delivery, existing: Delivery[]) {
  if (existing.some(item => item.customerId === d.customerId && deliveryDate(item) === deliveryDate(d))) throw new Error('La visita ya está registrada para este día.');
  if (![d.quantity, d.returned, d.amountCents, d.paidCents].every(n => Number.isSafeInteger(n) && n >= 0) || d.quantity < 1) throw new Error('Revisá las cantidades y los importes.');
  if (d.paidCents > d.amountCents) throw new Error('El pago no puede superar la venta en esta demostración.');
  if (d.method === 'Cuenta corriente' && d.paidCents !== 0) throw new Error('Para registrar un cobro elegí efectivo o transferencia.');
}

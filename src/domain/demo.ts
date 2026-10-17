export type Customer = { id: string; name: string; address: string; phone: string; days: string; quantity: number };
export type Delivery = { id: string; customerId: string; quantity: number; returned: number; amountCents: number; paidCents: number; method: 'Efectivo' | 'Transferencia' | 'Cuenta corriente' };
export type DemoState = { customers: Customer[]; order: string[]; deliveries: Delivery[] };
export const initialState: DemoState = {
  customers: [
    { id: 'maria', name: 'María González', address: 'San Martín 123', phone: '11 5555 0101', days: 'Lun · Jue', quantity: 2 },
    { id: 'carlos', name: 'Carlos López', address: 'Av. Belgrano 456', phone: '11 5555 0102', days: 'Mar · Vie', quantity: 1 },
    { id: 'ana', name: 'Ana Fernández', address: 'Rivadavia 789', phone: '11 5555 0103', days: 'Mié · Sáb', quantity: 3 },
    { id: 'jorge', name: 'Jorge Ramírez', address: 'Mitre 240', phone: '11 5555 0104', days: 'Lun · Jue', quantity: 2 },
  ], order: ['maria', 'carlos', 'ana', 'jorge'], deliveries: [],
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
  if (existing.some(item => item.customerId === d.customerId)) throw new Error('La visita ya está registrada.');
  if (![d.quantity, d.returned, d.amountCents, d.paidCents].every(n => Number.isSafeInteger(n) && n >= 0) || d.quantity < 1) throw new Error('Revisá las cantidades y los importes.');
  if (d.paidCents > d.amountCents) throw new Error('El pago no puede superar la venta en esta demostración.');
  if (d.method === 'Cuenta corriente' && d.paidCents !== 0) throw new Error('Para registrar un cobro elegí efectivo o transferencia.');
}

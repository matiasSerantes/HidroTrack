import { describe, expect, it } from 'vitest';
import { parseMoney, totals, validateDelivery, type Delivery } from './demo';
const delivery: Delivery = { id: 'operation', customerId: 'customer', quantity: 2, returned: 1, amountCents: 400000, paidCents: 150000, method: 'Efectivo' };
describe('dinero y entregas', () => {
 it('convierte decimales a centavos sin multiplicar un float', () => { expect(parseMoney('123,45')).toBe(12345); expect(parseMoney('0.29')).toBe(29); });
 it.each(['-1','1.999','NaN','','1e3'])('rechaza importe inválido %s', value => expect(() => parseMoney(value)).toThrow());
 it('separa cobros parciales, transferencias y deuda', () => { expect(totals([delivery, { ...delivery, id: 'other', method: 'Transferencia', paidCents: 100000 }])).toEqual({ units: 4, returned: 2, sales: 800000, cash: 150000, transfers: 100000, debt: 550000 }); });
 it('impide doble visita y cantidades inválidas', () => { expect(() => validateDelivery(delivery, [delivery])).toThrow(); expect(() => validateDelivery({ ...delivery, quantity: 1.5 }, [])).toThrow(); });
 it('rechaza sobrepago y cobros sin medio de pago', () => { expect(() => validateDelivery({ ...delivery, paidCents: 500000 }, [])).toThrow(); expect(() => validateDelivery({ ...delivery, method: 'Cuenta corriente' }, [])).toThrow(); });
});

export function readCustomerSince(value: string, today: string): string | null {
 if (!value) return null;
 const parsed = new Date(`${value}T12:00:00Z`);
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==value || value<'1900-01-01' || value>today) {
  throw new Error('La fecha desde que compra debe ser válida y no puede ser futura.');
 }
 return value;
}

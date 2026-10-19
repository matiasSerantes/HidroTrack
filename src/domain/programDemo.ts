import { parseMoney } from './demo';

export const DEMO_KEY = 'hidrotrack.complete-demo.v1';
export const demoDay = '2026-10-19';
export type Page = 'overview' | 'routes' | 'customers' | 'catalog' | 'inventory' | 'team' | 'approvals' | 'reports' | 'company';
export type Product = { id: string; name: string; unit: string; price: number; kind: 'sale' | 'rental'; returnable: boolean; depot: number; active: boolean };
export type Rental = { id: string; productId: string; serial: string; monthly: number };
export type Client = { id: string; name: string; address: string; locality: string; block: string; x: number; y: number; geo?: { lat: number; lng: number }; active: boolean; debt: number; held: Record<string, number>; rentals: Rental[]; usual: string; note: string };
export type Member = { id: string; name: string; role: 'owner' | 'driver'; active: boolean };
export type Stop = { clientId: string; status: 'pending' | 'visited' | 'later' | 'tomorrow' | 'no-sale' };
export type Trip = { id: string; name: string; driverId: string; stops: Stop[]; stage: 'planned' | 'active' | 'submitted' | 'approved'; load: Record<string, number>; stock: Record<string, number>; empties: Record<string, number>; declared: Record<string, number>; closeNote: string };
export type SaleItem = { productId: string; quantity: number; returned: number; price: number };
export type Sale = { id: string; clientId: string; tripId: string; actorId: string; items: SaleItem[]; rentalIds: string[]; rentalFee: number; total: number; paid: number; method: 'Efectivo' | 'Transferencia'; before: number; after: number; time: string };
export type Request = { id: string; kind: 'customer' | 'product' | 'user' | 'deactivation'; title: string; authorId: string; status: 'pending' | 'approved' | 'rejected'; clientId?: string; reason?: string; returns?: { rentalId: string; returned: boolean; good: boolean }[]; client?: Client; product?: Product; member?: Member };
export type DemoProgramState = { version: 1; company: { name: string; initials: string; locality: string; logo?: string }; clients: Client[]; products: Product[]; members: Member[]; trips: Trip[]; sales: Sale[]; requests: Request[]; notices: { id: string; text: string; read: boolean }[]; depotEmpties: Record<string, number>; presence?: Record<string, { clientId: string; time: string; attending: boolean }> };
export const uid = () => crypto.randomUUID();
export const DEMO_ORIGIN = { lat: -34.60905, lng: -58.3832 };
export const DEMO_ADDRESSES: Record<string, { address: string; lat: number; lng: number }> = {
  c1: { address: 'Av. de Mayo 1200', lat: -34.60935, lng: -58.38365 },
  c2: { address: 'Av. de Mayo 1250', lat: -34.60950, lng: -58.38420 },
  c3: { address: 'Av. de Mayo 1280', lat: -34.60957, lng: -58.38465 },
};
/** Actualiza solo los tres ejemplos originales; conserva operaciones y altas locales. */
export function withDemoAddresses(state: DemoProgramState): DemoProgramState {
  return { ...state, trips: state.trips.map(t => t.id === 't1' && t.name === 'Ballester · mañana' ? { ...t, name: 'Monserrat · tres paradas' } : t), clients: state.clients.map(c => {
    const location = DEMO_ADDRESSES[c.id];
    if (!location || c.geo) return c;
    return { ...c, address: location.address, locality: 'Monserrat, CABA', block: 'avdemayo-1200', geo: { lat: location.lat, lng: location.lng } };
  }) };
}
const stop = (clientId: string): Stop => ({ clientId, status: 'pending' });
export function seedProgram(): DemoProgramState {
  return withDemoAddresses({
    version: 1, company: { name: 'Agua Clara', initials: 'AC', locality: 'Villa Ballester' },
    products: [
      { id: 'b20', name: 'Bidón 20 litros', unit: 'unidad', price: 350000, kind: 'sale', returnable: true, depot: 240, active: true },
      { id: 'b12', name: 'Bidón 12 litros', unit: 'unidad', price: 240000, kind: 'sale', returnable: true, depot: 120, active: true },
      { id: 'soda', name: 'Sifón de soda', unit: 'sifón', price: 120000, kind: 'sale', returnable: true, depot: 180, active: true },
      { id: 'cajon', name: 'Cajón de soda · 6 sifones', unit: 'cajón de 6', price: 650000, kind: 'sale', returnable: true, depot: 35, active: true },
      { id: 'frio', name: 'Dispenser frío / calor', unit: 'equipo · mes', price: 1800000, kind: 'rental', returnable: false, depot: 8, active: true },
      { id: 'bomba', name: 'Bomba manual', unit: 'unidad', price: 600000, kind: 'sale', returnable: false, depot: 20, active: true },
    ],
    members: [{ id: 'owner', name: 'Santiago · jefe', role: 'owner', active: true }, { id: 'luz', name: 'Lucía Medina', role: 'driver', active: true }, { id: 'nico', name: 'Nicolás Ríos', role: 'driver', active: true }],
    clients: [
      { id: 'c1', name: 'Elena Duarte', address: 'Alvear 1240', locality: 'Villa Ballester', block: 'alvear-1200', x: 28, y: 27, active: true, debt: 480000, held: { b20: 2, soda: 3 }, rentals: [], usual: '2 bidones de 20 L', note: 'Tocar timbre del local. Prefiere por la mañana.' },
      { id: 'c2', name: 'Café La Esquina', address: 'Alvear 1278', locality: 'Villa Ballester', block: 'alvear-1200', x: 37, y: 30, active: true, debt: 0, held: { b20: 3 }, rentals: [{ id: 'rent1', productId: 'frio', serial: 'FC-DEMO-021', monthly: 1800000 }], usual: '3 bidones de 20 L', note: 'Entrada por el café. Equipo en alquiler.' },
      { id: 'c3', name: 'Martín Acosta', address: 'Lacroze 840', locality: 'Villa Ballester', block: 'lacroze-800', x: 60, y: 46, active: true, debt: 0, held: { b12: 2 }, rentals: [], usual: '2 bidones de 12 L', note: 'Si no está, consultar si puede recibir después.' },
      { id: 'c4', name: 'Almacén Los Tilos', address: 'Independencia 215', locality: 'San Andrés', block: 'independencia-200', x: 76, y: 68, active: true, debt: 220000, held: { cajon: 2 }, rentals: [], usual: '1 cajón de soda', note: 'Abierto hasta las 18 h.' },
      { id: 'c5', name: 'Paula Ferrer', address: 'Alvear 1216', locality: 'Villa Ballester', block: 'alvear-1200', x: 23, y: 35, active: true, debt: 0, held: { b20: 1 }, rentals: [], usual: '1 bidón de 20 L', note: 'Puede recibir por la tarde.' },
      { id: 'c6', name: 'Estudio Robles', address: 'San Martín 530', locality: 'San Andrés', block: 'sanmartin-500', x: 47, y: 76, active: true, debt: 0, held: { b20: 2 }, rentals: [], usual: '2 bidones de 20 L', note: 'Atención en recepción.' },
      { id: 'c7', name: 'Cliente de ejemplo · baja', address: 'Mitre 420', locality: 'San Andrés', block: 'mitre-400', x: 80, y: 34, active: false, debt: 0, held: {}, rentals: [], usual: 'Sin visitas', note: 'Baja histórica de ejemplo; solo visible para el jefe.' },
    ],
    presence: { luz: { clientId: 'c1', time: '09:15', attending: false } },
    trips: [
      { id: 't1', name: 'Ballester · mañana', driverId: 'luz', stops: ['c1', 'c2', 'c3'].map(stop), stage: 'active', load: { b20: 40, b12: 20, soda: 30, cajon: 8, frio: 1, bomba: 2 }, stock: { b20: 40, b12: 20, soda: 30, cajon: 8, frio: 1, bomba: 2 }, empties: {}, declared: {}, closeNote: '' },
      { id: 't2', name: 'San Andrés · mañana', driverId: 'nico', stops: ['c4', 'c6'].map(stop), stage: 'planned', load: {}, stock: {}, empties: {}, declared: {}, closeNote: '' },
    ], sales: [], depotEmpties: { b20: 32, b12: 18, soda: 45, cajon: 6 },
    requests: [{ id: 'req1', kind: 'customer', title: 'Alta de cliente · Florencia Demo', authorId: 'nico', status: 'pending', client: { id: 'c8', name: 'Florencia Demo', address: 'Mitre 280', locality: 'San Andrés', block: 'mitre-200', x: 67, y: 61, active: true, debt: 0, held: {}, rentals: [], usual: '2 bidones de 20 L', note: 'Solicitud de ejemplo creada por un asistente.' } }],
    notices: [{ id: 'n1', text: 'Nicolás solicitó el alta de un cliente. Revisá las aprobaciones.', read: false }],
  });
}
export function readProgram(): DemoProgramState {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null');
    if (parsed?.version === 1 && ['clients', 'products', 'members', 'trips', 'sales', 'requests', 'notices'].every(k => Array.isArray(parsed[k])) && parsed.company && parsed.depotEmpties) return withDemoAddresses(parsed);
  } catch { /* Una copia local inválida vuelve a los ejemplos. */ }
  return seedProgram();
}
function integer(n: number) { if (!Number.isSafeInteger(n) || n < 0 || n > 100000) throw new Error('Usá cantidades enteras entre 0 y 100.000.'); }
function notify(s: DemoProgramState, text: string) { s.notices.unshift({ id: uid(), text, read: false }); }
export function recordVisit(state: DemoProgramState, input: { tripId: string; clientId: string; actorId: string; items: { productId: string; quantity: number; returned: number }[]; rentalIds?: string[]; paid: string; method: Sale['method'] }): DemoProgramState {
  const s = structuredClone(state), trip = s.trips.find(t => t.id === input.tripId), client = s.clients.find(c => c.id === input.clientId);
  if (!trip || !client?.active || trip.stage !== 'active') throw new Error('Necesitás un reparto activo y un cliente habilitado.');
  if (input.actorId !== 'owner' && trip.driverId !== input.actorId) throw new Error('Este reparto no está asignado a tu usuario.');
  const member = s.members.find(m => m.id === input.actorId);
  if (!member?.active) throw new Error('El usuario está desactivado.');
  const visit = trip.stops.find(p => p.clientId === client.id);
  if (!visit || !['pending', 'later'].includes(visit.status)) throw new Error('La parada ya fue resuelta o no pertenece al reparto.');
  const items: SaleItem[] = [], ids = new Set<string>(), newRentals: string[] = [];
  for (const item of input.items) {
    integer(item.quantity); integer(item.returned);
    if (ids.has(item.productId)) throw new Error('El artículo está repetido.');
    ids.add(item.productId);
    const product = s.products.find(p => p.id === item.productId && p.active);
    if (!product) throw new Error('El artículo no está disponible.');
    if (item.quantity > (trip.stock[product.id] || 0)) throw new Error(`No alcanza el stock de ${product.name}.`);
    if (item.returned && !product.returnable) throw new Error('Este artículo no tiene envase retornable.');
    if (item.returned > (client.held[product.id] || 0) + item.quantity) throw new Error(`La devolución supera los envases de ${product.name} en poder del cliente.`);
    if (!item.quantity && !item.returned) continue;
    trip.stock[product.id] = (trip.stock[product.id] || 0) - item.quantity;
    trip.empties[product.id] = (trip.empties[product.id] || 0) + item.returned;
    if (product.returnable) client.held[product.id] = (client.held[product.id] || 0) + item.quantity - item.returned;
    if (product.kind === 'rental') for (let n = 0; n < item.quantity; n++) { const id = uid(); newRentals.push(id); client.rentals.push({ id, productId: product.id, serial: `DEMO-${s.sales.length + 1}-${n + 1}`, monthly: product.price }); }
    items.push({ ...item, price: product.price });
  }
  const rentalIds = [...new Set(input.rentalIds || [])];
  const rentalFee = rentalIds.reduce((sum, id) => { const rental = client.rentals.find(r => r.id === id); if (!rental || s.sales.some(sale => sale.rentalIds?.includes(id))) throw new Error('El alquiler ya se cobró en el período demo o no pertenece al cliente.'); return sum + rental.monthly; }, 0);
  rentalIds.push(...newRentals);
  const total = items.reduce((a, i) => a + i.price * i.quantity, 0) + rentalFee, paid = parseMoney(input.paid), before = client.debt;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(before + total)) throw new Error('El importe excede el rango permitido para la demo.');
  if (paid > total + before) throw new Error('El cobro supera la venta más la deuda anterior.');
  if (!items.length && !paid && !rentalFee) throw new Error('Cargá una entrega, devolución o cobro; para una visita sin operación usá «No compró».');
  client.debt = before + total - paid; visit.status = 'visited';
  const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
  s.sales.unshift({ id: uid(), clientId: client.id, tripId: trip.id, actorId: input.actorId, items, rentalIds, rentalFee, total, paid, method: input.method, before, after: client.debt, time });
  s.presence = { ...s.presence, [input.actorId]: { clientId: client.id, time, attending: false } };
  notify(s, `${member.name}: visita registrada en ${client.name}. Venta y cobro actualizados.`);
  return s;
}
export function loadTrip(state: DemoProgramState, tripId: string, quantities: Record<string, number>) {
  const s = structuredClone(state), trip = s.trips.find(t => t.id === tripId);
  if (!trip || trip.stage !== 'planned') throw new Error('Solo podés cargar un reparto que todavía no comenzó.');
  if (s.trips.some(t => t.id !== trip.id && t.driverId === trip.driverId && ['active', 'submitted'].includes(t.stage))) throw new Error('Cerrá y aprobá el reparto anterior de este repartidor antes de iniciar otro.');
  if (!Object.values(quantities).some(q => q > 0)) throw new Error('Ingresá al menos un artículo para salir.');
  for (const p of s.products) { const q = quantities[p.id] || 0; integer(q); if (q > p.depot) throw new Error(`No alcanza el stock de depósito de ${p.name}.`); p.depot -= q; }
  trip.load = { ...quantities }; trip.stock = { ...quantities }; trip.stage = 'active';
  notify(s, `Comenzó ${trip.name}. Carga del transporte registrada.`); return s;
}
export function decideRequest(state: DemoProgramState, requestId: string, approve: boolean) {
  const s = structuredClone(state), r = s.requests.find(x => x.id === requestId);
  if (!r || r.status !== 'pending') throw new Error('Esta solicitud ya fue resuelta.');
  if (approve) {
    if (r.kind === 'customer' && r.client) s.clients.push(r.client);
    if (r.kind === 'product' && r.product) s.products.push(r.product);
    if (r.kind === 'user' && r.member) s.members.push(r.member);
    if (r.kind === 'deactivation') {
      const c = s.clients.find(x => x.id === r.clientId);
      if (!c) throw new Error('No encontramos al cliente.');
      if (r.returns?.some(x => !x.returned || !x.good)) throw new Error('Esta demo exige devolver los equipos en buen estado antes de aprobar. Podés rechazar y revisar el caso.');
      c.active = false; c.note = `Baja aprobada: ${r.reason}. ${c.note}`;
      for (const rental of c.rentals) { const p = s.products.find(x => x.id === rental.productId); if (p) p.depot++; }
      c.rentals = [];
      s.trips.forEach(t => { if (['planned', 'active'].includes(t.stage)) t.stops = t.stops.filter(stop => stop.clientId !== c.id || !['pending', 'later', 'tomorrow'].includes(stop.status)); });
    }
  }
  r.status = approve ? 'approved' : 'rejected'; notify(s, `${r.title}: ${approve ? 'aprobada' : 'rechazada'} por el jefe.`); return s;
}
export function closeTrip(state: DemoProgramState, tripId: string, declared: Record<string, number>, note: string) {
  const s = structuredClone(state), t = s.trips.find(x => x.id === tripId);
  if (!t || t.stage !== 'active') throw new Error('El reparto no está activo.');
  if (t.stops.some(p => ['pending', 'later'].includes(p.status))) throw new Error('Resolvé las paradas pendientes antes de rendir. Podés pasarlas a otro día.');
  for (const p of s.products) integer(declared[p.id] || 0);
  const differs = s.products.some(p => (declared[p.id] || 0) !== (t.stock[p.id] || 0));
  if (differs && !note.trim()) throw new Error('Explicá la diferencia entre el regreso esperado y el declarado.');
  t.declared = { ...declared }; t.closeNote = note.trim(); t.stage = 'submitted'; notify(s, `${t.name}: rendición enviada al jefe${differs ? ' con diferencias' : ''}.`); return s;
}
export function approveClose(state: DemoProgramState, tripId: string) {
  const s = structuredClone(state), t = s.trips.find(x => x.id === tripId);
  if (!t || t.stage !== 'submitted') throw new Error('La rendición no está pendiente de aprobación.');
  if (s.products.some(p => (t.declared[p.id] || 0) !== (t.stock[p.id] || 0))) throw new Error('Hay diferencias: observá la rendición para que el asistente la revise.');
  for (const p of s.products) { p.depot += t.declared[p.id] || 0; s.depotEmpties[p.id] = (s.depotEmpties[p.id] || 0) + (t.empties[p.id] || 0); }
  t.stage = 'approved'; notify(s, `${t.name}: rendición aprobada; productos y vacíos ingresaron al depósito.`); return s;
}
export const isDone = (s: Stop) => ['visited', 'no-sale', 'tomorrow'].includes(s.status);
export const moneyInput = (cents: number) => String(cents / 100);

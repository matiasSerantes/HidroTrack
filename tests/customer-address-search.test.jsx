// @vitest-environment jsdom
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {CustomerLocationPicker,readCustomerLocation} from '../src/features/CustomerLocationPicker';
import {addressSearchUrl,parseAddressResults} from '../src/domain/addressSearch';
vi.mock('../src/features/CustomerLocationMap',()=>({default:({initial,onSelect,disabled})=><section aria-label="Mapa de prueba"><output>{initial?`${initial.lat},${initial.lng}`:'Sin punto'}</output><button type="button" disabled={disabled} onClick={()=>onSelect({lat:-34.6091,lng:-58.3833})}>Ajustar puerta</button></section>}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const payload={features:[{geometry:{type:'Point',coordinates:[-58.3832,-34.609]},properties:{street:'Avenida de Mayo',housenumber:'1200',city:'Buenos Aires',country:'Argentina',countrycode:'AR'}}]};
function setup(initial){const submit=vi.fn(e=>e.preventDefault());const view=render(<form onSubmit={submit}><label>Dirección<input name="address" defaultValue="Avenida de Mayo 1200"/></label><label>Localidad<input name="locality" defaultValue="Buenos Aires"/></label><CustomerLocationPicker initial={initial}/><button>Guardar cliente</button></form>);return {...view,submit};}
it('busca solo al tocar usando direccion y localidad, sin datos personales extra',async()=>{
 const fetch=vi.fn(async()=>({ok:true,json:async()=>payload}));vi.stubGlobal('fetch',fetch);const {submit}=setup();expect(fetch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Buscar dirección en el mapa'}));await screen.findByRole('button',{name:/Avenida de Mayo 1200, Buenos Aires/});const url=new URL(fetch.mock.calls[0][0]);expect(url.searchParams.get('q')).toBe('Avenida de Mayo 1200, Buenos Aires');expect(url.searchParams.get('countrycode')).toBe('AR');expect(url.searchParams.get('limit')).toBe('5');expect(submit).not.toHaveBeenCalled();expect(readCustomerLocation(new FormData(document.querySelector('form')))).toBeUndefined();
});
it('elegir resultado centra punto, permite ajustar puerta y conserva direccion escrita',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>payload})));setup();fireEvent.click(screen.getByRole('button',{name:'Buscar dirección en el mapa'}));fireEvent.click(await screen.findByRole('button',{name:/Avenida de Mayo 1200, Buenos Aires/}));await screen.findByLabelText('Mapa de prueba');expect(readCustomerLocation(new FormData(document.querySelector('form')))).toEqual({lat:-34.609,lng:-58.3832});fireEvent.click(screen.getByRole('button',{name:'Ajustar puerta'}));expect(readCustomerLocation(new FormData(document.querySelector('form')))).toEqual({lat:-34.6091,lng:-58.3833});expect(screen.getByLabelText('Dirección').value).toBe('Avenida de Mayo 1200');
});
it('error y ausencia de resultados conservan punto anterior',async()=>{
 const fetch=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ok:true,json:async()=>({features:[]})});vi.stubGlobal('fetch',fetch);setup({lat:0,lng:0});fireEvent.click(screen.getByRole('button',{name:'Buscar dirección en el mapa'}));await screen.findByRole('alert');expect(readCustomerLocation(new FormData(document.querySelector('form')))).toEqual({lat:0,lng:0});fireEvent.click(screen.getByRole('button',{name:'Buscar dirección en el mapa'}));await screen.findByText(/No encontramos esa dirección/);expect(readCustomerLocation(new FormData(document.querySelector('form')))).toEqual({lat:0,lng:0});
});
it('enter busca sin guardar y una solicitud pendiente no se duplica',async()=>{
 let resolve;const fetch=vi.fn(()=>new Promise(r=>{resolve=r;}));vi.stubGlobal('fetch',fetch);const {submit,unmount}=setup();const input=screen.getByLabelText('Dirección para buscar en el mapa');fireEvent.change(input,{target:{value:'Calle de prueba 123, Localidad'}});fireEvent.keyDown(input,{key:'Enter'});expect(fetch).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Buscando dirección…'}).disabled).toBe(true);expect(submit).not.toHaveBeenCalled();const signal=fetch.mock.calls[0][1].signal;unmount();expect(signal.aborted).toBe(true);resolve({ok:true,json:async()=>payload});await new Promise(r=>setTimeout(r,0));
});
it('valida consulta y filtra coordenadas invalidas y resultados duplicados',()=>{
 expect(()=>addressSearchUrl('')).toThrow();const feature=payload.features[0];expect(parseAddressResults({features:[feature,feature,{geometry:{type:'Point',coordinates:[300,200]},properties:{name:'Mal'}}]})).toHaveLength(1);expect(()=>parseAddressResults(null)).toThrow();
});

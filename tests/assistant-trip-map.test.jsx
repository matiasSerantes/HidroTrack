// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
vi.mock('leaflet',()=>{
 const layer=()=>({addTo(){return this;},bindTooltip(){return this;},on(){return this;},remove:vi.fn(),clearLayers:vi.fn()});
 return {default:{map:()=>({setView(){return this;},fitBounds:vi.fn(),remove:vi.fn(),invalidateSize:vi.fn()}),tileLayer:layer,layerGroup:layer,circleMarker:layer,circle:layer,latLngBounds:vi.fn()}};
});
import AssistantTripMap from '../src/features/AssistantTripMap';
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
const stop={id:'a',name:'Claudio',address:'Iguazú 8771',locality:'Ciudad',latitude:-34.6,longitude:-58.4,position:1,outcome:'pending',phone:'',pending_recovery:false};
function setup(accuracy=20){
 Object.defineProperty(document,'hidden',{value:false,configurable:true});
 const getCurrentPosition=vi.fn(success=>success({coords:{latitude:-34.6,longitude:-58.4,accuracy},timestamp:Date.now()}));
 vi.stubGlobal('navigator',{geolocation:{getCurrentPosition}});
 const onSelect=vi.fn();render(<AssistantTripMap stops={[stop]} selectedId="a" onSelect={onSelect}/>);
 return {getCurrentPosition,onSelect};
}
it('consulta GPS solo por boton y requiere elegir parada para abrir atencion',()=>{
 const {getCurrentPosition,onSelect}=setup();expect(getCurrentPosition).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Ver mi ubicación actual'}));
 expect(screen.getByRole('region',{name:'Posible llegada'})).toBeTruthy();expect(onSelect).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Ver parada de Claudio'}));expect(onSelect).toHaveBeenCalledWith('a');
});
it('no propone llegada con GPS impreciso y borra sugerencia al ocultar o vencer muestra',()=>{
 setup(100);fireEvent.click(screen.getByRole('button',{name:'Ver mi ubicación actual'}));expect(screen.queryByRole('region',{name:'Posible llegada'})).toBeNull();cleanup();
 vi.useFakeTimers();setup();fireEvent.click(screen.getByRole('button',{name:'Ver mi ubicación actual'}));
 act(()=>vi.advanceTimersByTime(30001));expect(screen.queryByRole('region',{name:'Posible llegada'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Ver mi ubicación actual'}));expect(screen.getByRole('region',{name:'Posible llegada'})).toBeTruthy();
 Object.defineProperty(document,'hidden',{value:true,configurable:true});fireEvent(document,new Event('visibilitychange'));expect(screen.queryByRole('region',{name:'Posible llegada'})).toBeNull();
});

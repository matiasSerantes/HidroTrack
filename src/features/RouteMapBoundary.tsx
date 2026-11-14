import {Component,type ReactNode} from 'react';

/** Keep a map/chunk failure from unmounting the working route. */
export class RouteMapBoundary extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){
  if(this.state.failed)return <section role="alert" className="assistant-route-stock"><h4>No pudimos abrir el mapa</h4><p>Tu reparto sigue disponible en la lista de paradas. Podés atender al cliente y abrir la navegación desde allí.</p><button type="button" className="hd-btn primary" onClick={()=>window.location.reload()}>Recargar reparto y reintentar</button></section>;
  return this.props.children;
 }
}

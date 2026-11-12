import './VisitCycleButtons.css';
export function VisitCycleButtons({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 return <div className="visit-cycle-buttons" role="group" aria-label="Cada cuánto lo visitás">{[['1','Todas las semanas'],['2','Cada 15 días'],['3','Cada 21 días']].map(([weeks,label])=><button type="button" key={weeks} disabled={disabled} aria-pressed={value===weeks} className={value===weeks?'selected':''} onClick={()=>onChange(weeks)}>{label}</button>)}</div>;
}

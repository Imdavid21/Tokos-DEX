export const METHODOLOGY_VERSION="rates-v1";
export function fixedHoldingReturn(apy:number,days:number){if(apy<=-1)throw new RangeError("APY must be greater than -100%");if(days<0)throw new RangeError("days must be non-negative");return Math.pow(1+apy,days/365)-1;}
export function floatingHoldingReturn(apr:number,days:number){if(days<0)throw new RangeError("days must be non-negative");return apr*days/365;}
export function basisBps(fixedRate:number,floatingRate:number){return Math.round((fixedRate-floatingRate)*10_000);}
export function changeBps(current:number,previous:number){return (current-previous)*10_000;}
export function percentile(current:number,values:readonly number[]){const valid=values.filter(Number.isFinite);if(!valid.length)return null;return 100*valid.filter(v=>v<=current).length/valid.length;}
export function standardDeviation(values:readonly number[]){const valid=values.filter(Number.isFinite);if(valid.length<2)return null;const mean=valid.reduce((a,b)=>a+b,0)/valid.length;const variance=valid.reduce((a,v)=>a+(v-mean)**2,0)/(valid.length-1);return Math.sqrt(variance);}
export function rateChangeVolatilityBps(values:readonly number[]){if(values.length<3)return null;const changes:number[]=[];for(let i=1;i<values.length;i++){const a=values[i-1],b=values[i];if(a!==undefined&&b!==undefined&&Number.isFinite(a)&&Number.isFinite(b))changes.push((b-a)*10_000);}return standardDeviation(changes);}
export interface CapacityPoint{notionalUsd:number;rate:number|null;fillable:boolean;}
export function maxCapacityAtRate(points:readonly CapacityPoint[],threshold:number,direction:"at-least"|"at-most"):{notionalUsd:number;estimated:boolean}|null{
 const sorted=[...points].filter(p=>p.fillable&&p.rate!==null&&Number.isFinite(p.rate)).sort((a,b)=>a.notionalUsd-b.notionalUsd);
 const qualifies=(r:number)=>direction==="at-least"?r>=threshold:r<=threshold;let last:CapacityPoint|null=null;
 for(const p of sorted){if(p.rate===null)continue;if(qualifies(p.rate)){last=p;continue;}if(!last||last.rate===null||p.notionalUsd===last.notionalUsd)return last?{notionalUsd:last.notionalUsd,estimated:false}:null;const span=p.rate-last.rate;if(span===0)return{notionalUsd:last.notionalUsd,estimated:false};const t=(threshold-last.rate)/span;if(t<=0||t>=1)return{notionalUsd:last.notionalUsd,estimated:false};return{notionalUsd:last.notionalUsd+t*(p.notionalUsd-last.notionalUsd),estimated:true};}
 return last?{notionalUsd:last.notionalUsd,estimated:false}:null;
}

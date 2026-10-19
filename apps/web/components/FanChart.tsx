type Path={ratio:number[];loss:number[];significant:boolean};
/** Server-rendered fan of the stored sample paths: collateral/loan ratio over the year, loss paths highlighted. */
export function FanChart({paths,lltvRatioFloor}:{paths:Path[];lltvRatioFloor:number|null}){
  if(!paths.length)return null;
  const W=760,H=240,padL=40,padR=14,padT=16,padB=26;
  const all=paths.flatMap(p=>p.ratio);const lo=Math.max(0.05,Math.min(...all,lltvRatioFloor??1)*0.92),hi=Math.max(...all,1.05)*1.04;
  const n=paths[0]!.ratio.length;const X=(i:number)=>padL+(i/(n-1))*(W-padL-padR);const Y=(v:number)=>padT+(1-(Math.log(v)-Math.log(lo))/(Math.log(hi)-Math.log(lo)))*(H-padT-padB);
  const sig=paths.filter(p=>p.significant),ok=paths.filter(p=>!p.significant);
  const line=(p:Path)=>p.ratio.map((v,i)=>`${i?"L":"M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  return <svg className="fan" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sample of simulated collateral to loan ratio paths over one year">
    {lltvRatioFloor!=null&&lltvRatioFloor>lo&&<><rect x={padL} y={Y(lltvRatioFloor)} width={W-padL-padR} height={Math.max(0,Y(lo)-Y(lltvRatioFloor))} fill="var(--ember)" opacity={0.07}/><line x1={padL} x2={W-padR} y1={Y(lltvRatioFloor)} y2={Y(lltvRatioFloor)} stroke="var(--ember)" strokeDasharray="3 4" opacity={0.8}/><text x={W-padR} y={Y(lltvRatioFloor)-5} textAnchor="end" fontSize={9} fill="var(--ember)" fontFamily="var(--font-mono)">liquidation of the riskiest bucket</text></>}
    <line x1={padL} x2={W-padR} y1={Y(1)} y2={Y(1)} stroke="var(--border)"/>
    {[0,3,6,9,12].map(m=><g key={m}><line x1={X(m)} x2={X(m)} y1={padT} y2={H-padB} stroke="var(--grid)"/><text x={X(m)} y={H-8} fontSize={9} textAnchor="middle" fill="var(--muted-2)" fontFamily="var(--font-mono)">{m===0?"t0":`${m}m`}</text></g>)}
    {[lo,1,hi].map(v=><text key={v} x={padL-6} y={Y(v)+3} fontSize={9} textAnchor="end" fill="var(--muted-2)" fontFamily="var(--font-mono)">{v.toFixed(2)}</text>)}
    {ok.map((p,i)=><path key={i} d={line(p)} fill="none" stroke="var(--text)" strokeWidth={0.9} opacity={0.22}/>)}
    {sig.map((p,i)=><path key={`s${i}`} d={line(p)} fill="none" stroke="var(--ember)" strokeWidth={1.3} opacity={0.85}/>)}
  </svg>
}

import {BANDS,gradeClass} from "@/lib/ratings";
/** Grade seal: the grade and where the PSL sits inside its band (0 = lower edge, 1 = upper edge). */
export function Seal({grade,psl,large=false}:{grade:string;psl:number|null|undefined;large?:boolean}){
  const b=BANDS.find(x=>x.grade===grade);let pos=0.5;
  if(b&&psl!=null){const lo=Math.log10(Math.max(1e-5,b.lower||1e-5)),hi=Math.log10(b.upper??1);pos=Math.max(0.04,Math.min(1,(Math.log10(Math.max(1e-5,psl))-lo)/Math.max(1e-6,hi-lo)))}
  return <span className={`seal ${gradeClass(grade)} ${large?"lg":""}`} title={b?`${grade}: ${(b.lower*100).toFixed(1)}% to ${b.upper==null?"100":(b.upper*100).toFixed(1)}% annual PSL`:"Not rated"}><b>{grade}</b><i style={{"--pos":grade==="NR"?0:pos} as React.CSSProperties}/></span>
}

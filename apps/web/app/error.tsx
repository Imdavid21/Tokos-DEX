"use client";
import {DataState} from "@/components/DataState";
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <div className="page"><DataState kind="provider" title="This view could not load" detail="The normalized data service returned an error. No values were substituted."/><div className="toolbar" style={{justifyContent:"center",marginTop:12}}><button className="btn" onClick={reset}>Retry</button></div></div>}

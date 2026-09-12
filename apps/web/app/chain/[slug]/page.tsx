import {EntityAnalyticsPage} from "@/components/EntityAnalyticsPage";
export default async function ChainPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;return <EntityAnalyticsPage kind="chain" id={decodeURIComponent(slug)}/>}

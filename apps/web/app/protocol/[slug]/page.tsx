import {EntityAnalyticsPage} from "@/components/EntityAnalyticsPage";
export default async function ProtocolPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;return <EntityAnalyticsPage kind="protocol" id={decodeURIComponent(slug)}/>}

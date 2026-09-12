import {EntityAnalyticsPage} from "@/components/EntityAnalyticsPage";
export default async function AssetPage({params}:{params:Promise<{slug:string}>}){const{slug}=await params;return <EntityAnalyticsPage kind="asset" id={decodeURIComponent(slug)}/>}

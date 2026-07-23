import { GET_PERMISSIONS_API } from "..";

export async function getPermissions(){
    const {url,...meta} = GET_PERMISSIONS_API;
    return await fetch(url, {...meta,credentials:'include'})
}

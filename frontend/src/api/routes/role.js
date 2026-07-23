import { GET_ROLE_API } from "..";

export async function getRoles(){
    const {url,...meta} = GET_ROLE_API;
    return await fetch(url, {...meta,credentials:'include'})
}
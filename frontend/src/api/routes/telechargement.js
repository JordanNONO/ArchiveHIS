import { TELECHARGEMENTS_API } from "..";

export async function getTelechargements(){
    const {url,...meta} = TELECHARGEMENTS_API;
    return await fetch(url, {...meta,credentials:'include'})
}

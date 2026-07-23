import { CREATE_BUREAU_API, GET_BUREAU_API } from "..";

export async function getBureaux(){
    const {url,...meta} = GET_BUREAU_API;
    return await fetch(url, {...meta,credentials:'include'})
}

export async function createBureaux(data){
    const {url,...meta} = CREATE_BUREAU_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}
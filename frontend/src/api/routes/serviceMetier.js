import { GET_SERVICES_METIER_API, CREATE_SERVICE_METIER_API, UPDATE_SERVICE_METIER_API, DELETE_SERVICE_METIER_API, ARCHIVES_SERVICE_METIER_API } from "..";

export async function getServicesMetier(){
    const {url,...meta} = GET_SERVICES_METIER_API;
    return await fetch(url, {...meta,credentials:'include'})
}

export async function createServiceMetier(data){
    const {url,...meta} = CREATE_SERVICE_METIER_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function updateServiceMetier(id, data){
    const {url,...meta} = UPDATE_SERVICE_METIER_API;
    return await fetch(url+`/${id}`, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function deleteServiceMetier(id){
    const {url,...meta} = DELETE_SERVICE_METIER_API;
    return await fetch(url+`/${id}`, {...meta,credentials:'include'})
}

export async function getServiceMetierArchives(id){
    const {url,...meta} = ARCHIVES_SERVICE_METIER_API;
    return await fetch(url+`/${id}/archives`, {...meta,credentials:'include'})
}

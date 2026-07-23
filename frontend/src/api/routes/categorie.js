import { CREATE_CATEGORIE_API, DELETE_CATEGORIE_API, GET_CATEGORIE_API, UPDATE_CATEGORIE_API } from "..";

export async function getCategorie(){
    const {url,...meta} = GET_CATEGORIE_API;
    return await fetch(url, {...meta,credentials:'include'})
}

export async function createCategorie(data){
    const {url,...meta} = CREATE_CATEGORIE_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}
/**
 * 
 * @param {Number} id 
 * @returns 
 */
export async function getCategorieById(id){
    const {url,...meta} = GET_CATEGORIE_API;
    return await fetch(url+`/${id}`, {...meta,credentials:'include'})
}

/**
 * 
 * @param {Number} id 
 * @returns 
 */
export async function deleteCategorieById(id){
    const {url,...meta} = DELETE_CATEGORIE_API;
    return await fetch(url+`/${id}`, {...meta,credentials:'include'})
}

/**
 * 
 * @param {object} data 
 * @param {Number} id 
 * @returns 
 */
export async function updateCatgory(data,id){
    const {url,...meta} =UPDATE_CATEGORIE_API
    return await fetch(url+`/${id}`,{...meta,body:JSON.stringify(data), credentials:'include'})
}
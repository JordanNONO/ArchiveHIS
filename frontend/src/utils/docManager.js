import { deleteCategorieById, updateCatgory } from "../api/routes/categorie";

/**
 * 
 * @param {object} data 
 * @returns 
 */
export async function renameDoc(data){
    return await updateCatgory(data)
}

/**
 * 
 * @param {Number} id 
 * @returns 
 */
export async function deleteDoc(id){
    return await deleteCategorieById(id);
}
import { deleteCategorieById, updateCatgory } from "../api/routes/categorie";

export async function renameDoc(data){
    return await updateCatgory(data)
}

export async function deleteDoc(id){
    return await deleteCategorieById(id);
}
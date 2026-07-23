import { GET_ROLE_API, CREATE_ROLE_API, UPDATE_ROLE_API, DELETE_ROLE_API, ATTACH_ROLE_PERMISSIONS_API } from "..";

export async function getRoles(){
    const {url,...meta} = GET_ROLE_API;
    return await fetch(url, {...meta,credentials:'include'})
}

export async function createRole(data){
    const {url,...meta} = CREATE_ROLE_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function updateRole(id, data){
    const {url,...meta} = UPDATE_ROLE_API;
    return await fetch(url+`/${id}`, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function deleteRole(id){
    const {url,...meta} = DELETE_ROLE_API;
    return await fetch(url+`/${id}`, {...meta,credentials:'include'})
}

/**
 * Remplace l'ensemble des permissions d'un rôle.
 * @param {Number} id
 * @param {Number[]} permissionIds
 */
export async function attachRolePermissions(id, permissionIds){
    const {url,...meta} = ATTACH_ROLE_PERMISSIONS_API;
    return await fetch(url+`/${id}/permissions`, {...meta,body:JSON.stringify({permission_ids:permissionIds}),credentials:'include'})
}

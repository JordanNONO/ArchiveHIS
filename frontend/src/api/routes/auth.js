import { AUTH_UPDATE_API, LOGIN_API, LOGOUT_API } from "../index";

export async function loginAPI(data) {
    const { url, ...meta } = LOGIN_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function updateLoginAPI(data) {
    const { url, ...meta } = AUTH_UPDATE_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function logoutAPI(){
    const {url,...meta} = LOGOUT_API;
    return await fetch(url, {...meta,credentials:'include'})
}
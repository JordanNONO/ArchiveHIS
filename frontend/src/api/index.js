export const SERVER_URL = process.env.NODE_ENV === 'production' ? 'https://backend.estlc-unv-ebolowa.com' : 'http://localhost:8000';
const BASE_URL =SERVER_URL+'/api'
const token = sessionStorage.getItem("token")
export const LOGIN_API = {
    url: `${BASE_URL}/auth`,
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    }
}
export const LOGOUT_API = {
    url: `${BASE_URL}/auth/logout`,
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    }
}
export const AUTH_ME_API = {
    url: `${BASE_URL}/auth/me`,
    method: "GET",
    headers: {
        "Authorization": `Bearer ${token}`
    }
}
export const AUTH_UPDATE_API = {
    url: `${BASE_URL}/auth/update`,
    method: "PUT",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    }
}
export const GET_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "GET",
    headers: {
        "Authorization": `Bearer ${token}`
    }
}
export const POST_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`
    }
}
export const SHARE_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    }
}
export const TRACK_DOCUMENTS_CONSULT_API = {
    url: `${BASE_URL}/consultations`,
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    }
}
export const UPDATE_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "PUT",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"

    }
}
export const DELETE_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "DELETE",
    headers: {
        "Authorization": `Bearer ${token}`
    }
}

export const GET_ROLE_API = {
    url: `${BASE_URL}/roles`,
    method: "GET",
    headers: {
        "Authorization": `Bearer ${token}`,
    }
}
export const GET_BUREAU_API = {
    url: `${BASE_URL}/bureaux`,
    method: "GET",
    headers: {
        "Authorization": `Bearer ${token}`,
    }
}

export const GET_PERSONNEL_API = {
    url: `${BASE_URL}/personnels`,
    method: "GET",
    headers: {
        "Authorization": `Bearer ${token}`,
    }
}


export const CREATE_BUREAU_API = {
    url: `${BASE_URL}/bureaux`,
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    }
}
export const DELETE_BUREAU_API = {
    url: `${BASE_URL}/bureaux`,
    method: "DELETE",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    }
}

export const CREATE_PERSONNEL_API = {
    url: `${BASE_URL}/personnels`,
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    }
}
export const UPDATE_PERSONNEL_API = {
    url: `${BASE_URL}/personnels`,
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    }
}
export const UPDATE_PERSONNEL_PROFILE_API = {
    url: `${BASE_URL}/personnels/profile`,
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`
    }
}

export const GET_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "GET",
    headers: {
        "Authorization": `Bearer ${token}`,
    }
}

export const DELETE_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "DELETE",
    headers: {
        "Authorization": `Bearer ${token}`,
    }
}

export const UPDATE_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "PUT",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    }
}

export const CREATE_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "POST",
    headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    }
}
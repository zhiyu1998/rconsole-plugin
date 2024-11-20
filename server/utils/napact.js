import { NAPCAT_GET_LOGIN_INFO, NAPCAT_GET_STATUS, NAPCAT_GET_VERSION_INFO } from "../constants/napcat.js";

export async function getUserInfo() {
    const userInfo = await fetch(NAPCAT_GET_LOGIN_INFO).then(resp => resp.json());
    const { user_id, nickname } = userInfo.data;
    return { user_id, nickname }
}

export async function getStatus() {
    const status = await fetch(NAPCAT_GET_STATUS).then(resp => resp.json());
    return status.data;
}

export async function getVersionInfo() {
    const versionInfo = await fetch(NAPCAT_GET_VERSION_INFO).then(resp => resp.json());
    return versionInfo.data;
}

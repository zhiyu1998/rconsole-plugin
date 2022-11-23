//import xx from f.js

class jFeatch {
  async get(url) {
    const r = await fetch(url);
    return await r.json();
  }
  async post(url, params) {
    const r = await fetch(url, { ...params, method: "POST" });
    return await r.json();
  }
}

export default new jFeatch();

const fetch = require("node-fetch");

const rdapikeys = [
  // "SJ65TDDYCXOMVWFYHSN3ZQTLFO3YT3DYHSUQZGV7EIBE3G7DJHSA",
  "MWSWTCYAE6IYXURMWCTBBVK5RACCMWFRKQI7XZPFJHHHFOWZ4HNA",
];
const rdapikey = rdapikeys[Math.floor(Math.random() * rdapikeys.length)];

let headers = {
  Authorization: `Bearer ${rdapikey}`,
};

let checkTorrentFileinRD = async (hash = "") => {
  if (!hash) return false;
  let url = `https://api.real-debrid.com/rest/1.0/torrents/instantAvailability/${hash}`;
  try {
    let res = await fetch(url, { method: "GET", headers });
    if (res.statusText != "OK") return null;
    let resJson = await res.json();
    return resJson;
  } catch (error) {
    return null;
  }
};

let addTorrentFileinRD = async (magnet = "") => {
  if (!magnet) return false;
  let url = `https://api.real-debrid.com/rest/1.0/torrents/addMagnet`;
  let form = new URLSearchParams();
  form.append("magnet", magnet);
  try {
    let res = await fetch(url, { method: "POST", headers, body: form });
    let resJson = await res.json();
    return resJson;
  } catch (error) {
    return false;
  }
};

let getTorrentInfofromRD = async (id = "") => {
  if (!id) return null;

  let url = `https://api.real-debrid.com/rest/1.0/torrents/info/${id}`;
  try {
    let res = await fetch(url, { method: "GET", headers });
    if (res.statusText != "OK") return null;
    let resJson = await res.json();
    return resJson;
  } catch (error) {
    return null;
  }
};

let selectFilefromRD = async (id = "", files = "all") => {
  if (!id) return false;
  let url = `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${id}`;
  try {
    let form = new URLSearchParams();
    form.append("files", "all");
    let res = await fetch(url, { method: "POST", headers, body: form });
    if (res.status < 400) return true;
    return false;
  } catch (error) {
    console.log({ add: error });
    return false;
  }
};

let unrestrictLinkfromRD = async (link = "") => {
  if (!link) return {};
  let url = `https://api.real-debrid.com/rest/1.0/unrestrict/link`;
  try {
    let form = new URLSearchParams();
    form.append("link", link);
    let res = await fetch(url, { method: "POST", headers, body: form });
    if (res.statusText == "OK") return await res.json();
    return {};
  } catch (error) {
    return {};
  }
};

let removeDuplicate = (data = [], key = "name") => {
  let response = [];
  data.forEach((one, i) => {
    let index_ = response.findIndex((el) => el[key] == one[key]);
    index_ == -1 ? response.push(one) : null;
  });
  return response;
};

module.exports = {
  rdapikey,
  checkTorrentFileinRD,
  addTorrentFileinRD,
  getTorrentInfofromRD,
  selectFilefromRD,
  unrestrictLinkfromRD,
  removeDuplicate,
};

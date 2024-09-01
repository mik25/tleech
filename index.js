require("dotenv").config();
const parseTorrent = require("parse-torrent");
const express = require("express");
const app = express();
const fetch = require("node-fetch");
// var WebTorrent = require("webtorrent");
var torrentStream = require("torrent-stream");
const {
  addTorrentFileinRD,
  getTorrentInfofromRD,
  selectFilefromRD,
  unrestrictLinkfromRD,
  removeDuplicate,
} = require("./helper");

const REGEX = {
  season_range:
    /S(?:(eason )|(easons )|(eason )|(easons )|(aisons )|(aison ))?(?<start>\d{1,2})\s*?(?:-|&|à|et)\s*?(?<end>\d{1,2})/, //start and end Sxx-xx|Season(s) xx-xx|Sxx à xx
  ep_range: /((?:e)|(?:ep))?(?: )?(?<start>\d{1,4})-(?<end>\d{1,4})/, //xxx-xxx
  ep_rangewithS:
    /((?:e)|(?:pisode))\s*(?<start>\d{1,3}(?!\d)|\d\d\d??)(?:-?e?(?<end>\d{1,3}))?(?!\d)/, //Exxx-xxx
};

function getSize(size) {
  var gb = 1024 * 1024 * 1024;
  var mb = 1024 * 1024;

  return (
    "💾 " +
    (size / gb > 1
      ? `${(size / gb).toFixed(2)} GB`
      : `${(size / mb).toFixed(2)} MB`)
  );
}

function getQuality(name) {
  if (!name) {
    return name;
  }
  name = name.toLowerCase();

  if (["2160", "4k", "uhd"].filter((x) => name.includes(x)).length > 0)
    return "🌟4k";
  if (["1080", "fhd"].filter((x) => name.includes(x)).length > 0)
    return " 🎥FHD";
  if (["720", "hd"].filter((x) => name.includes(x)).length > 0) return "📺HD";
  if (["480p", "380p", "sd"].filter((x) => name.includes(x)).length > 0)
    return "📱SD";
  return "";
}

// ----------------------------------------------

let isVideo = (element) => {
  return (
    element["name"]?.toLowerCase()?.includes(`.mkv`) ||
    element["name"]?.toLowerCase()?.includes(`.mp4`) ||
    element["name"]?.toLowerCase()?.includes(`.avi`) ||
    element["name"]?.toLowerCase()?.includes(`.flv`)
  );
};

//------------------------------------------------------------------------------------------

const toStream = async (
  parsed,
  uri,
  tor,
  type,
  s,
  e,
  abs_season,
  abs_episode,
  abs
) => {
  const infoHash = parsed.infoHash.toLowerCase();
  let title = tor.extraTag || parsed.name;
  let index = -1;

  if (!parsed.files && uri.startsWith("magnet:?")) {
    var engine = torrentStream("magnet:" + uri, { connections: 20 });
    try {
      let res = await new Promise((resolve, reject) => {
        engine.on("ready", function () {
          resolve(engine.files);
        });
        setTimeout(() => {
          resolve([]);
        }, 18000); //
      });
      parsed.files = res;
    } catch (error) {
      console.log("Done with that error");
      return null;
    }
    engine ? engine.destroy() : null;
  }

  if (media == "series") {
    index = (parsed.files ?? []).findIndex((element, index) => {
      if (!element["name"]) {
        return false;
      }

      let name = element["name"].toLowerCase();

      if (
        name.includes("movie") ||
        name.includes("live") ||
        name.includes("ova")
      ) {
        return false;
      }

      let containEandS = (element) =>
        //SxxExx
        //SxExx
        //SxExx
        //axb
        //Sxx - Exx
        //Sxx.Exx
        //Season xx Exx
        //SasEae selon abs
        //SasEaex  selon abs
        //SasEaexx  selon abs
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")}e${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s}e${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")}e${e}`) ||
        element["name"]?.toLowerCase()?.includes(`${s}x${e}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")} - e${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")}.e${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s}${e?.padStart(2, "0")}`) ||
        // element["name"]?.toLowerCase()?.includes(`s${s}e${e}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")}e${e}`) ||
        element["name"]?.toLowerCase()?.includes(`season ${s} e${e}`) ||
        (abs &&
          (element["name"]
            ?.toLowerCase()
            ?.includes(
              `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(
                2,
                "0"
              )}`
            ) ||
            element["name"]
              ?.toLowerCase()
              ?.includes(
                `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(
                  3,
                  "0"
                )}`
              ) ||
            element["name"]
              ?.toLowerCase()
              ?.includes(
                `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(
                  4,
                  "0"
                )}`
              )));

      let containE_S = (element) =>
        //Sxx - xx
        //Sx - xx
        //Sx - x
        //Season x - x
        //Season x - xx
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s?.padStart(2, "0")} - ${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`s${s} - ${e?.padStart(2, "0")}`) ||
        // element["name"]?.toLowerCase()?.includes(`s${s} - ${e}`) ||
        // element["name"]?.toLowerCase()?.includes(`season ${s} - ${e}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`season ${s} - ${e?.padStart(2, "0")}`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(`season ${s} - ${e?.padStart(2, "0")}`);

      let containsAbsoluteE = (element) =>
        //- xx
        //- xxx
        //- xxxx
        //- 0x
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(2, "0")} `) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(3, "0")} `) ||
        element["name"]?.toLowerCase()?.includes(` 0${abs_episode} `) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(4, "0")} `);

      let containsAbsoluteE_ = (element) =>
        // xx.
        // xxx.
        // xxxx.
        // 0x.
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(2, "0")}.`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(3, "0")}.`) ||
        element["name"]?.toLowerCase()?.includes(` 0${abs_episode}.`) ||
        element["name"]
          ?.toLowerCase()
          ?.includes(` ${abs_episode?.padStart(4, "0")}.`);

      return (
        isVideo(element) &&
        (containEandS(element) ||
          containE_S(element) ||
          (((abs && containsAbsoluteE(element)) ||
            (abs && containsAbsoluteE_(element))) &&
            !(
              element["name"]?.toLowerCase()?.includes("s0") ||
              element["name"]?.toLowerCase()?.includes(`s${abs_season}`) ||
              element["name"]?.toLowerCase()?.includes("e0") ||
              element["name"]?.toLowerCase()?.includes(`e${abs_episode}`) ||
              element["name"]?.toLowerCase()?.includes("season")
            )))
      );
    });
    //
    if (index == -1) {
      return null;
    }

    title = !!title ? title + "\n" + parsed.files[index]["name"] : null;
  }

  if (media == "movie") {
    index = (parsed?.files ?? []).findIndex((element, index) => {
      // console.log({ element: element["name"] });
      return isVideo(element);
    });
    //
    if (index == -1) {
      return null;
    }
  }

  // ========================== RD =============================
  // console.log({ parsed: parsed["name"] });
  // console.log({ magnetUri: parseTorrent.toMagnetURI(parsed) });

  console.log("Trynna some RD");
  let folderId = null;

  let details = [];
  let data = await addTorrentFileinRD(parseTorrent.toMagnetURI(parsed));
  folderId = "id" in data ? data["id"] : null;
  let added = await selectFilefromRD(folderId);
  if (folderId) {
    let torrentDetails = await getTorrentInfofromRD(folderId);
    let files = (torrentDetails["files"] ?? []).filter(
      (el) => el["selected"] == 1
    );
    let links = torrentDetails["links"] ?? [];

    let selectedIndex =
      files.length == 1
        ? 0
        : files.findIndex((el) =>
            el["path"]
              ?.toLowerCase()
              ?.includes(parsed.files[index]["name"]?.toLowerCase())
          );
    details = [await unrestrictLinkfromRD(links[selectedIndex] ?? null)];
  }

  // ===========================================================

  title = title ?? parsed.files[index]["name"];

  title += "\n" + getQuality(title);

  const subtitle = "S:" + tor["Seeders"] + " | P:" + tor["Peers"];
  title += ` | ${
    index == -1 || parsed.files == []
      ? `${getSize(0)}`
      : `${getSize(parsed.files[index]["length"] ?? 0)}`
  } | ${subtitle}`;

  if (
    details.length > 0 &&
    details[details.length > 1 ? index : 0]["download"]
  ) {
    return {
      name: `RD-${tor["Tracker"]}`,
      url: details[details.length > 1 ? index : 0]["download"],
      title: title ?? details[details.length > 1 ? index : 0]["filename"],
      behaviorHints: {
        bingeGroup: `Jackett-Addon|${infoHash}`,
      },
    };
  }

  return null;
};

//------------------------------------------------------------------------------------------

let isRedirect = async (url) => {
  try {
    // console.log({ url });
    const controller = new AbortController();
    // 5 second timeout:
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });

    // console.log(response.status);
    // console.log(response.headers);

    clearTimeout(timeoutId);

    if (response.status === 301 || response.status === 302) {
      const locationURL = new URL(
        response.headers.get("location"),
        response.url
      );
      if (response.headers.get("location").startsWith("http")) {
        await isRedirect(locationURL);
      } else {
        return response.headers.get("location");
      }
    } else if (response.status >= 200 && response.status < 300) {
      return response.url;
    } else {
      // return response.url;
      return null;
    }
  } catch (error) {
    // console.log({ error });
    return null;
  }
};

const streamFromMagnet = (
  tor,
  uri,
  type,
  s,
  e,
  abs_season,
  abs_episode,
  abs
) => {
  return new Promise(async (resolve, reject) => {
    //follow redirection cause some http url sent magnet url
    let realUrl = uri?.startsWith("magnet:?") ? uri : await isRedirect(uri);

    realUrl = realUrl ?? null;

    if (realUrl) {
      // console.log({ realUrl });
      if (realUrl?.startsWith("magnet:?")) {
        resolve(
          toStream(
            parseTorrent(realUrl),
            realUrl,
            tor,
            type,
            s,
            e,
            abs_season,
            abs_episode,
            abs
          )
        );
      } else if (realUrl?.startsWith("http")) {
        parseTorrent.remote(realUrl, (err, parsed) => {
          if (!err) {
            resolve(
              toStream(
                parsed,
                realUrl,
                tor,
                type,
                s,
                e,
                abs_season,
                abs_episode,
                abs
              )
            );
          } else {
            // console.log("err parsing http");
            resolve(null);
          }
        });
      } else {
        // console.log("no http nor magnet");
        resolve(realUrl);
      }
    } else {
      // console.log("no real uri");
      resolve(null);
    }
  });
};

let torrent_results = [];
let hosts = [];

const raw_content = require("fs").readFileSync("./servers.txt");
let content = Buffer.isBuffer(raw_content)
  ? raw_content.toString()
  : raw_content;
hosts = content
  .split("\n")
  .map((el) => el.trim())
  .map((el) => {
    if (!el.includes("|")) return null;
    return {
      host: el.split("|")[0],
      apiKey: el.split("|").pop(),
    };
  });

hosts = hosts.filter(el => !!el)

let fetchTorrent = async (query, type = "series") => {
  let hostdata = hosts[Math.floor(Math.random() * hosts.length)];
  if(!hostdata) return [];
  let url = `${hostdata.host}/api/v2.0/indexers/all/results?apikey=${
    hostdata.apiKey
  }&Query=${query}${
    type == "series"
      ? "&Category%5B%5D=5000"
      : type == "movie"
      ? "&Category%5B%5D=2000"
      : ""
  }&Category%5B%5D=8000&Tracker%5B%5D=torrentleech&cache=false`;

  return await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      "x-requested-with": "XMLHttpRequest",
      cookie:
        "Jackett=CfDJ8AG_XUDhxS5AsRKz0FldsDJIHUJANrfynyi54VzmYuhr5Ha5Uaww2hSQytMR8fFWjPvDH2lKCzaQhRYI9RuK613PZxJWz2tgHqg1wUAcPTMfi8b_8rm1Igw1-sZB_MnimHHK7ZSP7HfkWicMDaJ4bFGZwUf0xJOwcgjrwcUcFzzsVSTALt97-ibhc7PUn97v5AICX2_jsd6khO8TZosaPFt0cXNgNofimAkr5l6yMUjShg7R3TpVtJ1KxD8_0_OyBjR1mwtcxofJam2aZeFqVRxluD5hnzdyxOWrMRLSGzMPMKiaPXNCsxWy_yQhZhE66U_bVFadrsEeQqqaWb3LIFA",
    },
    referrerPolicy: "no-referrer",
    method: "GET",
  })
    .then(async (res) => {
      try {
        return await res.json();
      } catch (error) {
        console.log({ error });
        return {};
      }
    })
    .then(async (results) => {
      console.log({ Initial: results["Results"]?.length });
      // console.log({ Response: results["Results"] });
      if (results["Results"].length != 0) {
        torrent_results = await Promise.all(
          results["Results"].map((result) => {
            return new Promise((resolve, reject) => {
              resolve({
                Tracker: result["Tracker"],
                Category: result["CategoryDesc"],
                Title: result["Title"],
                Seeders: result["Seeders"],
                Peers: result["Peers"],
                Link: result["Link"],
                MagnetUri: result["MagnetUri"],
                DownloadVolumeFactor: result["DownloadVolumeFactor"],
                UploadVolumeFactor: result["UploadVolumeFactor"],
              });
            });
          })
        );
        return torrent_results;
      } else {
        return [];
      }
    })
    .catch((err) => {
      return [];
    });
};

function getMeta(id, type) {
  var [tt, s, e] = id.split(":");

  return fetch(`https://v3-cinemeta.strem.io/meta/${type}/${tt}.json`)
    .then((res) => res.json())
    .then((json) => {
      return {
        name: json.meta["name"],
        year: json.meta["releaseInfo"]?.substring(0, 4) ?? 0,
      };
    })
    .catch((err) =>
      fetch(`https://v2.sg.media-imdb.com/suggestion/t/${tt}.json`)
        .then((res) => res.json())
        .then((json) => {
          return json.d[0];
        })
        .then(({ l, y }) => ({ name: l, year: y }))
    );
}

async function getImdbFromKitsu(id) {
  var [kitsu, _id, e] = id.split(":");

  return fetch(`https://anime-kitsu.strem.fun/meta/anime/${kitsu}:${_id}.json`)
    .then((_res) => _res.json())
    .then((json) => {
      return json["meta"];
    })
    .then((json) => {
      try {
        let imdb = json["imdb_id"];
        let meta = json["videos"].find((el) => el.id == id);
        return [
          imdb,
          (meta["imdbSeason"] ?? 1).toString(),
          (meta["imdbEpisode"] ?? 1).toString(),
          (meta["season"] ?? 1).toString(),
          (meta["imdbSeason"] ?? 1).toString() == 1
            ? (meta["imdbEpisode"] ?? 1).toString()
            : (meta["episode"] ?? 1).toString(),
          meta["imdbEpisode"] != meta["episode"] || meta["imdbSeason"] == 1,
        ];
      } catch (error) {
        return null;
      }
    })
    .catch((err) => null);
}

app
  .get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    //
    var json = {
      id: "hy.jackettrdftl.stream",
      version: "1.0.3",
      name: "Torrentleech",
      description: "Movie & TV Streams from Torrentleech rd2",
      logo: "data:image/jpeg;base64,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",
      resources: [
        {
          name: "stream",
          types: ["movie", "series"],
          idPrefixes: ["tt", "kitsu"],
        },
      ],
      types: ["movie", "series", "anime", "other"],
      catalogs: [],
    };

    return res.send(json);
  })
  .get("/stream/:type/:id", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    //
    media = req.params.type;
    let id = req.params.id;
    id = id.replace(".json", "");

    let tmp = [];

    if (id.includes("kitsu")) {
      tmp = await getImdbFromKitsu(id);
      if (!tmp) {
        return res.send({ stream: {} });
      }
    } else {
      tmp = id.split(":");
    }

    let [tt, s, e, abs_season, abs_episode, abs] = tmp;

    console.log(tmp);

    let meta = await getMeta(tt, media);

    console.log({ meta: id });
    console.log({ name: meta?.name, year: meta?.year });

    let query = "";
    query = meta?.name;

    let result = [];

    if (media == "movie") {
      query += " " + meta?.year;
      result = await fetchTorrent(encodeURIComponent(query), "movie");
    } else if (media == "series") {
      let promises = [
        fetchTorrent(
          encodeURIComponent(`${query} S${(s ?? "1").padStart(2, "0")}`)
        ),
        fetchTorrent(
          encodeURIComponent(`${query} Saison ${(s ?? "1").padStart(2, "0")}`)
        ),
        fetchTorrent(encodeURIComponent(`${query} S${s ?? "1"}`)),
        // fetchTorrent(encodeURIComponent(`${query} Saison ${s ?? "1"}`)),
        fetchTorrent(
          encodeURIComponent(
            `${query} S${s?.padStart(2, "0")}E${e?.padStart(2, "0")}`
          )
        ),
      ];

      if (+s == 1) {
        promises.push(
          fetchTorrent(encodeURIComponent(`${query} ${e?.padStart(2, "0")}`))
        );
        // promises.push(fetchTorrent(encodeURIComponent(`${query}`)));
      }

      if (abs) {
        promises.push(
          fetchTorrent(
            encodeURIComponent(`${query} ${abs_episode?.padStart(3, "0")}`)
          )
        );
      }

      result = await Promise.all(promises);
      result = [
        ...result[0],
        ...result[1],
        ...result[2],
        ...result[3],
        // ...result[4],
        // ...(result?.length >= 4 ? result[3] : []),
        ...(result?.length >= 5 ? result[4] : []),
        ...(result?.length >= 6 ? result[5] : []),
        // ...(result?.length >= 7 ? result[6] : []),
      ];
    }

    // ------------------------------- FOR RANGE THINGS ---------------------------------------------

    let matches = [];

    for (const key in result) {
      const element = result[key];

      let r = new RegExp(REGEX.season_range, "gmi");
      let match = r.exec(element["Title"]);
      if (match && match["groups"] != null) {
        if (
          ![match["groups"]["start"], match["groups"]["end"]].includes(
            meta?.year
          )
        ) {
          if (s > +match["groups"]["start"] && s <= +match["groups"]["end"]) {
            matches.push(result[key]);
            result.splice(key, 1);
            continue;
          }
        }
      }

      r = new RegExp(REGEX.ep_range, "gmi");
      match = r.exec(element["Title"]);

      if (match && match["groups"] != null) {
        if (
          ![match["groups"]["start"], match["groups"]["end"]].includes(
            meta?.year
          )
        ) {
          if (
            abs_episode > +match["groups"]["start"] &&
            abs_episode <= +match["groups"]["end"]
          ) {
            matches.push(result[key]);
            result.splice(key, 1);
          }
        }
      }
    }
    result = [...matches, ...result];
    result = removeDuplicate(result, "Title");
    result.sort((a, b) => {
      return -(+a["Peers"] - +b["Peers"]) ?? 0;
    });

    console.log({ Retenus: result.length });

    const MAX_RES = process.env.MAX_RES ?? 20;
    result = result?.length >= MAX_RES ? result.splice(0, MAX_RES) : result;

    // ----------------------------------------------------------------------------

    let stream_results = await Promise.all(
      result.map((torrent) => {
        if (
          (torrent["MagnetUri"] != "" || torrent["Link"] != "") &&
          torrent["Peers"] >= 0
          // &&
          // (torrent["DownloadVolumeFactor"] == 0 ||
          //   (torrent["UploadVolumeFactor"] == 1 &&
          //     torrent["DownloadVolumeFactor"] == 0))
        ) {
          console.log(`${torrent["Title"]} ==> ${torrent["Peers"]}`);
          return streamFromMagnet(
            torrent,
            torrent["MagnetUri"] || torrent["Link"],
            media,
            s,
            e,
            abs_season
          );
        }
      })
    );

    stream_results = Array.from(new Set(stream_results)).filter((e) => !!e);

    console.log({ Final: stream_results.length });

    return res.send({ streams: stream_results });
  })
  .listen(process.env.PORT || 3000, () => {
    console.log("The server is working on " + process.env.PORT || 3000);
  });

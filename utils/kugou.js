// 获取MV信息的函数
export async function getKugouMv(msg, page_limit, count_limit, n) {
    const url = `https://mobiles.kugou.com/api/v3/search/mv?format=json&keyword=${encodeURIComponent(
        msg
    )}&page=${page_limit}&pagesize=${count_limit}&showtype=1`;
    try {
        const response = await fetch(url);
        const json = await response.json();
        const info_list = json.data.info;
        let data_list = [];

        if (n !== "") {
            const info = info_list[n];
            const json_data2 = await getMvData(info.hash);
            const mvdata_list = json_data2.mvdata;

            let mvdata = null;
            if ("sq" in mvdata_list) {
                mvdata = mvdata_list["sq"];
            } else if ("le" in mvdata_list) {
                mvdata = mvdata_list["le"];
            } else if ("rq" in mvdata_list) {
                mvdata = mvdata_list["rq"];
            }

            data_list = [
                {
                    name: info["filename"],
                    singername: info["singername"],
                    duration: new Date(info["duration"] * 1000)
                        .toISOString()
                        .substr(14, 5),
                    file_size: `${(mvdata["filesize"] / (1024 * 1024)).toFixed(2)} MB`,
                    mv_url: mvdata["downurl"],
                    cover_url: info["imgurl"].replace("/{size}", ""),
                    // 下面这些字段可能需要你从其他地方获取，因为它们不是直接从这个API返回的
                    // "play_count": json.play_count,
                    // "like_count": json.like_count,
                    // "comment_count": json.comment_count,
                    // "collect_count": json.collect_count,
                    // "publish_date": json.publish_date
                },
            ];
        } else {
            data_list = info_list.map((info) => ({
                name: info["filename"],
                singername: info["singername"],
                duration: new Date(info["duration"] * 1000).toISOString().substr(14, 5),
                cover_url: info["imgurl"].replace("/{size}", ""),
            }));
        }

        return data_list;
    } catch (error) {
        console.error("Error fetching MV data:", error);
        return [];
    }
}

// 获取歌曲信息的函数
export async function getKugouSong(msg, page_limit, count_limit, n) {
    const url = `https://mobiles.kugou.com/api/v3/search/song?format=json&keyword=${encodeURIComponent(
        msg
    )}&page=${page_limit}&pagesize=${count_limit}&showtype=1`;
    try {
        const response = await fetch(url);
        const json = await response.json();
        const info_list = json.data.info;
        // console.log(info_list)
        let data_list = [];

        if (n !== "") {
            const info = info_list[n];
            const song_hash = info.hash;
            let song_url = "付费歌曲暂时无法获取歌曲下载链接";
            let json_data2 = {};
            if (song_hash !== "") {
                json_data2 = await getMp3Data(song_hash);
                song_url = json_data2.error ? song_url : json_data2.url;
            }

            data_list = [
                {
                    name: info.filename,
                    singername: info.singername,
                    duration: new Date(info.duration * 1000).toISOString().substr(14, 5),
                    file_size: `${(json_data2.fileSize / (1024 * 1024)).toFixed(2)} MB`,
                    song_url: song_url,
                    album_img: json_data2.album_img?.replace("/{size}", ""),
                    // "mv_url": await get_kugou_mv(msg, page_limit, count_limit, n) 这可能会导致递归调用，视具体情况而定
                },
            ];
        } else {
            data_list = info_list.map((info) => ({
                name: info.filename,
                singername: info.singername,
                duration: new Date(info.duration * 1000).toISOString().substr(14, 5),
                hash: info.hash,
                mvhash: info.mvhash ? info.mvhash : null,
            }));
        }

        // 发送响应
        return {
            code: 200,
            text: "解析成功",
            type: "歌曲解析",
            now: new Date().toISOString(),
            data: data_list,
        };
    } catch (error) {
        console.error("Error fetching song data:", error);
        return { code: 500, text: "服务器内部错误" };
    }
}

// 获取MP3数据的函数
async function getMp3Data(song_hash) {
    const url = `https://m.kugou.com/app/i/getSongInfo.php?hash=${song_hash}&cmd=playInfo`;
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/6.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36"
            },
            redirect: 'follow',
            method: 'GET',
        });
        const json = await response.json();
        return json;
    } catch (error) {
        console.error("Error fetching MP3 data:", error);
        return {};
    }
}

// 获取MV数据的函数
async function getMvData(mv_hash) {
    const url = `http://m.kugou.com/app/i/mv.php?cmd=100&hash=${mv_hash}&ismp3=1&ext=mp4`;
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/6.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36"
            },
            redirect: 'follow',
            method: 'GET',
        });
        const json = await response.json();
        return json;
    } catch (error) {
        console.error("Error fetching MV data:", error);
        return {};
    }
}

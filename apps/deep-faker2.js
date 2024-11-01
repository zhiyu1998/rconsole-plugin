process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import fs from "fs";
import axios from 'axios'

const DOWNLOAD_PATH = "./data/";
const GPTSOVITS_HOST = "https://cn-sy-bgp-plustmp1.natfrp.cloud:49918"

const voiceList = Object.freeze([
    "雷军",
])

export class example extends plugin {
    constructor () {
        super({
            name: '语音包',
            dsc: '语音包',
            // 匹配的消息类型，参考https://oicqjs.github.io/oicq/#events
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: `^(${voiceList.join('|')})说(.*)`,
                    fnc: 'voicePack'
                },
                {
                    reg: "^语音列表$",
                    fnc: 'voiceList'
                }
            ]
        })
    }

    async voicePack(e) {
        const parts  = e.msg.trim()
        const part1 = parts.split("说", 1)[0];
        const part2 = parts.substring(parts.indexOf("说") + 1).replaceAll(" ", "，");

        // Data payload
        const data = {
            text: part2,
            text_language: "zh"
        };

        // Make the POST request
        axios.post(GPTSOVITS_HOST, data, { responseType: 'arraybuffer' })
            .then(response => {
                if (response.status === 400) {
                    throw new Error(`请求GPTSoVITS出现错误: ${response.data.message}`);
                }

                // Write the content to a file
                fs.writeFile(DOWNLOAD_PATH + "voicePack.wav", response.data, (err) => {
                    if (err) throw err;
                    e.reply(segment.record(fs.readFileSync(DOWNLOAD_PATH + "voicePack.wav")));
                });
            })
            .catch(error => {
                console.error('Error:', error.message);
            });
        return true
    }

    async voiceList(e) {
        e.reply(Bot.makeForwardMsg([{
            message: { type: "text", text: voiceList.join("\n") },
            nickname: e.sender.card || e.user_id,
            user_id: e.user_id,
        }]));
        return true
    }
}

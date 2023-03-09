import fetch from "node-fetch";
import { Group, segment } from "oicq";
import { autoTask } from "../utils/common.js";

// 指定定时发送的群号
const groupList = ["169721415"];

// 是否开启定时推送，默认为 true
let isAutoPush = false;

// 定时任务合集
autoTask(pushDailyWorld, "0 30 8 * * ?", groupList, isAutoPush);
autoTask(pushTouchFish, "0 31 8 * * ?", groupList, isAutoPush);

export class daily extends plugin {
    constructor(e) {
        super({
            name: "R插件每日任务",
            dsc: "R插件每日任务",
            event: "message",
            priority: 500,
            rule: [
                {
                    reg: "^#每天60秒$",
                    fnc: "dailyWorld",
                },
                {
                    reg: "^#摸鱼人日历$",
                    fnc: "touchFish",
                },
                {
                    reg: "^#开关每日推送$",
                    fnc: "shutdown",
                },
            ],
        });
    }

    async dailyWorld(e) {
        // 定时发送时间，采用 Cron 表达式，当前默认为每日 8:30 分推送
        await pushDailyWorld(e);
        return true;
    }

    async touchFish(e) {
        await pushTouchFish(e);
        return true;
    }

    async shutdown(e) {
        isAutoPush = !isAutoPush;
        e.reply(`【当前推送状态】：${isAutoPush ? "开启" : "关闭"}`);
    }
}

/**
 * 推送每天60秒读懂世界
 * @param e oicq传递的事件参数e
 */
async function pushDailyWorld(e) {
    // 每天60秒读懂世界接口地址
    const url = await fetch("https://api.vvhan.com/api/60s?type=json").catch(err =>
        console.error(err),
    );
    const imgUrl = await url.json();
    const res = await imgUrl.imgUrl;

    // 判断接口是否请求成功
    if (!res) {
        e.reply("[60秒读懂世界] 接口请求失败");
    }

    // 回复消息
    if (e instanceof Group) {
        e.sendMsg(segment.image(res));
    } else {
        e.reply(segment.image(res));
    }
}

async function pushTouchFish(e) {
    const url = await fetch("https://api.vvhan.com/api/moyu?type=json").catch(err =>
        console.error(err),
    );
    const imgUrl = await url.json();
    const res = await imgUrl.url;

    // 判断接口是否请求成功
    if (!res) {
        e.reply("[摸鱼人日历] 接口请求失败");
    }

    // 回复消息
    if (e instanceof Group) {
        e.sendMsg(segment.image(res));
    } else {
        e.reply(segment.image(res));
    }
}

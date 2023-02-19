import schedule from "node-schedule";
import common from "../../../lib/common/common.js";

/**
 * 请求模板
 */
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

/**
 * 每日推送函数
 * @param func 回调函数
 * @param time cron
 * @param isAutoPush 是否推送（开关）
 */
function autoTask(func, time, groupList, isAutoPush = false) {
    if (isAutoPush) {
        schedule.scheduleJob(time, () => {
            // 正常传输
            if (groupList instanceof Array) {
                for (let i = 0; i < groupList.length; i++) {
                    const group = Bot.pickGroup(groupList[i]);
                    func(group);
                    common.sleep(1000);
                }
                // 防止恶意破坏函数
            } else if (groupList instanceof String) {
                const group = Bot.pickGroup(groupList[i]);
                func(group);
                common.sleep(1000);
            } else {
                throw Error("错误传入每日推送参数！");
            }
        });
    }
}

export { jFeatch, autoTask };

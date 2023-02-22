// import mongoose from "mongoose";

// mongoose.connect("mongodb://127.0.0.1:27017/rconsole");
// const Chat = mongoose.model("chats", new mongoose.Schema({ q: String, ans: String }));

export class rchat extends plugin {
    constructor(e) {
        super({
            name: "自定义回复",
            dsc: "R插件插件自定义回复",
            event: "message",
            priority: 500,
            rule: [
                // {
                //     reg: (e === undefined ? false : e.atme)
                //         ? "^[^add|del|update](.*)"
                //         : "#rchat(.*)",
                //     fnc: "queryChat",
                // },
                // {
                //     reg: (e === undefined ? false : e.atme) ? "add(.*)" : "#rchat add(.*)",
                //     fnc: "addCustomContent",
                // },
                // {
                //     reg: (e === undefined ? false : e.atme) ? "del(.*)" : "#rchat del(.*)",
                //     fnc: "delCustomContent",
                // },
                // {
                //     reg: (e === undefined ? false : e.atme) ? "update(.*)" : "#rchat update(.*)",
                //     fnc: "updateCustomContent",
                // },
            ],
        });
    }

    // async queryChat(e) {
    //     // 获取到想要聊天的内容
    //     const content = e.msg.trim();
    //     // 模糊查询
    //     await Chat.find({ q: new RegExp(content) }).then(res => {
    //         // 原答案
    //         // console.log(res);
    //         for (let epoch of res) {
    //             if (epoch.q.trim() === content) {
    //                 e.reply(epoch.ans);
    //                 return true;
    //             }
    //         }
    //         // 回复最接近的结果
    //         e.reply(res[0].ans);
    //     });
    // }
    //
    // async addCustomContent(e) {
    //     const q = /add*(.*)/.exec(e.msg)[1].trim();
    //     await new Chat({ q, ans: "" }).save();
    //     await e.reply(`问题:${q}，需要怎么回答？`, false, { at: true });
    //     this.setContext("addCustomAns");
    // }
    //
    // async addCustomAns() {
    //     // 如果不回复或者回复其他
    //     if (!this.e.msg) {
    //         return true;
    //     }
    //     // 当前消息
    //     const curMsg = this.e;
    //     // 上一个消息
    //     const preMsg = this.getContext();
    //     // console.log(preMsg)
    //     // console.log(preMsg.addCustomAns)
    //     const q = /add*(.*)/.exec(preMsg.addCustomAns.msg)[1].trim();
    //     const ans = curMsg.msg.trim();
    //     await Chat.updateOne({ q }, { ans });
    //     this.finish("addCustomAns");
    // }
    //
    // async delCustomContent(e) {
    //     const removeContent = /del*(.*)/.exec(e.msg)[1].trim();
    //     await Chat.deleteOne({ q: removeContent }).then(res => {
    //         e.reply(`已经删除${removeContent}`);
    //     });
    //     return true;
    // }
    //
    // async updateCustomContent(e) {
    //     const updateContent = /update*(.*)/.exec(e.msg)[1].trim();
    //     await Chat.findOne({ q: updateContent }).then(res => {
    //         e.reply(`我觉得：${res.q}，应该回答${res.ans}，你觉得我该怎么回答？`);
    //     });
    //     this.setContext("updateCustomAns");
    //     return true;
    // }
    //
    // async updateCustomAns() {
    //     // 如果不回复或者回复其他
    //     if (!this.e.msg) {
    //         return true;
    //     }
    //     // 当前消息
    //     const curMsg = this.e;
    //     // 上一个消息
    //     const preMsg = this.getContext();
    //     const q = /update*(.*)/.exec(preMsg.updateCustomAns.msg)[1].trim();
    //     const ans = curMsg.msg.trim();
    //     await Chat.findOneAndUpdate({ q }, { $set: { ans } }).then(res => {
    //         curMsg.reply(`明白了，${q}，应该回答${ans}`);
    //     });
    //     this.finish("updateCustomAns");
    // }
}

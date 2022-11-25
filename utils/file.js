import fs from "node:fs";
import path from "path";

// 同步递归创建文件夹
function mkdirsSync (dirname) {
    if (fs.existsSync(dirname)) {
        return true;
    } else {
        if (this.mkdirsSync(path.dirname(dirname))) {
            fs.mkdirSync(dirname);
            return true;
        }
    }
}

// 递归创建目录 异步方法
function mkdirs (dirname, callback) {
    fs.exists(dirname, function (exists) {
        if (exists) {
            callback();
        } else {
            // console.log(path.dirname(dirname));
            this.mkdirs(path.dirname(dirname), function () {
                fs.mkdir(dirname, callback);
            });
        }
    });
}

export { mkdirs, mkdirsSync }
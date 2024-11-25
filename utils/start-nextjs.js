import { spawn } from 'child_process';
import { hasIPv6Only } from "./network.js";

logger.mark(`[R插件][WebUI], 父进程 PID: ${process.pid}`);

let nextjsProcess = null;

// 启动子进程运行 Next.js
export const startNextJs = (mode = 'start') => {
    let script = mode === 'start' ? 'start' : 'dev';

    logger.info(logger.yellow(`[R插件][WebUI监测]，启动 WebUI ${mode} 进程...`));

    if (hasIPv6Only()) {
        script = 'dev6';
    }

    nextjsProcess = spawn('pnpm', ['run', script], {
        cwd: './plugins/rconsole-plugin', // 指定工作目录
        stdio: 'ignore',
        shell: true,
    });

    // 子进程异常退出时捕获信号
    nextjsProcess.on('close', (code) => {
        logger.error(`[R插件][WebUI监测]，WebUI 进程发生异常 ${code}`);
        nextjsProcess = null;
    });

    nextjsProcess.on('error', (err) => {
        logger.error(`[R插件][WebUI监测] 子进程错误: ${err.message}`);
    });
};

// 捕获父进程退出信号
export const cleanup = () => {
    logger.info(logger.yellow('[R插件][WebUI监测] 父进程退出，终止子进程...'));
    if (nextjsProcess) {
        // 终止子进程
        nextjsProcess.kill();
        nextjsProcess = null;
    }
    process.exit();
};

// 绑定父进程的退出信号
process.on('SIGINT', cleanup); // Ctrl+C 信号
process.on('SIGTERM', cleanup); // kill 命令信号
process.on('exit', cleanup); // 正常退出

import { spawn } from 'child_process';

logger.info(`[R插件][Next.js监测], 父进程 PID: ${process.pid}`);

let nextjsProcess = null;

// 构建应用程序
export const buildNextJs = () => {
    logger.info(logger.yellow('[R插件][Next.js监测]，正在构建 Next.js 应用...'));
    return new Promise((resolve, reject) => {
        const buildProcess = spawn('pnpm', ['run', 'build'], {
            cwd: './plugins/rconsole-plugin/server',
            stdio: 'ignore',
            shell: true,
        });

        buildProcess.on('close', (code) => {
            if (code === 0) {
                logger.info(logger.yellow('[R插件][Next.js监测]，构建完成。'));
                resolve();
            } else {
                logger.error(`[R插件][Next.js监测]，构建失败，退出码：${code}`);
                reject(new Error('Build failed'));
            }
        });
    });
};

// 启动子进程运行 Next.js
export const startNextJs = (mode = 'start') => {
    const script = mode === 'start' ? 'start' : 'dev';

    logger.info(logger.yellow(`[R插件][Next.js监测]，启动 Next.js ${mode} 进程...`));

    nextjsProcess = spawn('pnpm', ['run', script], {
        cwd: './plugins/rconsole-plugin', // 指定工作目录
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'], // 继承父进程的标准输入输出
        shell: true,
    });

    // 子进程异常退出时捕获信号
    nextjsProcess.on('close', (code) => {
        logger.error(`[R插件][Next.js监测]，Next.js 进程发生异常 ${code}`);
        nextjsProcess = null;
    });
};

// 捕获父进程退出信号
const cleanup = () => {
    logger.info(logger.yellow('[R插件][Next.js监测] 父进程退出，终止子进程...'));
    if (nextjsProcess) {
        nextjsProcess.kill(); // 终止子进程
    }
    process.exit();
};

// 绑定父进程的退出信号
process.on('SIGINT', cleanup); // Ctrl+C 信号
process.on('SIGTERM', cleanup); // kill 命令信号
process.on('exit', cleanup); // 正常退出

import { spawn } from 'child_process';

logger.info(`[R插件][Next.js监测], 父进程 PID: ${process.pid}`);

let childProcess = null;

// 启动子进程运行 Next.js
export const startNextJs = () => {
    logger.info(logger.yellow('[R插件][Next.js监测]，启动 Next.js 进程...'));
    // 加载名称
    childProcess = spawn('pnpm', ['run', 'dev'], {
        cwd: './plugins/rconsole-plugin', // 指定工作目录
        stdio: 'inherit'      // 继承父进程的标准输入输出
    });

    // 子进程异常退出时捕获信号
    childProcess.on('close', (code) => {
        logger.error(`[R插件][Next.js监测]，Next.js 进程发生异常 ${code}`);
        childProcess = null;
    });
};

// 捕获父进程退出信号
const cleanup = () => {
    logger.info(logger.yellow('[R插件][Next.js监测] 父进程退出，终止子进程...'));
    if (childProcess) {
        childProcess.kill(); // 终止子进程
    }
    process.exit();
};

// 绑定父进程的退出信号
process.on('SIGINT', cleanup);  // Ctrl+C 信号
process.on('SIGTERM', cleanup); // kill 命令信号
process.on('exit', cleanup);    // 正常退出

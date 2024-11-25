import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { REDIS_UPDATE_PATH, REDIS_UPDATE_STATUS } from "../../../../constants/redis.js";
import { redis } from "../../../../utils/redis.js";

const execAsync = promisify(exec);

// Git错误处理函数
function handleGitError(error, stderr) {
    if (error.message.includes('RPC failed')) {
        return '网络连接失败，请检查网络后重试';
    }
    if (error.message.includes('early EOF')) {
        return '数据传输中断，请重试';
    }
    if (error.message.includes('fetch-pack: invalid index-pack output')) {
        return '数据包错误，请重试';
    }
    if (error.message.includes('Timed out')) {
        return '连接超时，请检查网络后重试';
    }
    if (error.message.includes('Could not resolveControl host')) {
        return '无法解析主机地址，请检查网络';
    }
    if (error.message.includes('Permission denied')) {
        return '权限被拒绝，请检查git权限配置';
    }
    if (error.message.includes('be overwritten by merge')) {
        return '存在冲突，请使用强制更新';
    }

    // 如果是其他错误，返回具体错误信息
    return stderr || error.message || '未知错误';
}

async function ensureDirectory(dir) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

async function copyConfig(src, dest) {
    try {
        await ensureDirectory(path.dirname(dest));
        await fs.cp(src, dest, { recursive: true });
        console.log(`成功复制配置文件从 ${src} 到 ${dest}`);
        return true;
    } catch (error) {
        console.error(`复制配置文件失败: ${error.message}`);
        return false;
    }
}

// 清理更新状态和临时文件
async function cleanupUpdate(tempDir) {
    try {
        // 清理临时文件
        await fs.rm(tempDir, { recursive: true, force: true });
        // 清理Redis中的更新状态
        await redis.del(REDIS_UPDATE_STATUS);
        await redis.del(REDIS_UPDATE_PATH);
        console.log('清理完成');
    } catch (error) {
        console.error('清理失败:', error);
    }
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const isCheck = searchParams.get('check') === 'true';
        const isRestore = searchParams.get('restore') === 'true';
        const isForce = searchParams.get('force') === 'true';

        // 如果是检查请求
        if (isCheck) {
            const updateStatus = await redis.get(REDIS_UPDATE_STATUS);
            return new Response(JSON.stringify({
                needsRestore: updateStatus === 'restoring'
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // 如果是恢复请求
        if (isRestore) {
            const updateStatus = await redis.get(REDIS_UPDATE_STATUS);
            const paths = JSON.parse(await redis.get(REDIS_UPDATE_PATH) || '{}');

            if (updateStatus === 'restoring' && paths.tempDir && paths.configDir) {
                try {
                    await copyConfig(paths.tempDir, paths.configDir);
                    await cleanupUpdate(paths.tempDir);
                    return new Response(JSON.stringify({
                        success: true,
                        message: '配置恢复完成'
                    }), {
                        headers: { 'Content-Type': 'application/json' },
                    });
                } catch (error) {
                    return new Response(JSON.stringify({
                        success: false,
                        message: '配置恢复失败：' + error.message
                    }), {
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
            }

            return new Response(JSON.stringify({
                success: true,
                message: '无需恢复'
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const projectRoot = path.join(process.cwd(), '..');
        const tempDir = path.join(projectRoot, 'temp', 'update-tmp');
        const configDir = path.join(projectRoot, 'config');

        // 检查是否有未完成的更新
        const updateStatus = await redis.get(REDIS_UPDATE_STATUS);
        if (updateStatus === 'restoring') {
            // 如果有未完成的更新，尝试恢复
            const paths = JSON.parse(await redis.get(REDIS_UPDATE_PATH) || '{}');
            if (paths.tempDir && paths.configDir) {
                try {
                    await copyConfig(paths.tempDir, paths.configDir);
                    console.log('恢复了之前未完成的配置文件更新');
                } finally {
                    await cleanupUpdate(paths.tempDir);
                }
            }
        }

        console.log('开始新的更新流程');

        // 保存路径信息到Redis
        await redis.set(REDIS_UPDATE_PATH, JSON.stringify({
            tempDir,
            configDir
        }));
        await redis.set(REDIS_UPDATE_STATUS, 'started');

        // 确保临时目录存在
        await ensureDirectory(tempDir);

        // 备份配置文件
        let configBackedUp = false;
        try {
            await fs.access(configDir);
            await copyConfig(configDir, tempDir);
            configBackedUp = true;
            console.log('配置文件备份成功');
            await redis.set(REDIS_UPDATE_STATUS, 'backed_up');
        } catch (error) {
            console.log('无配置文件需要备份或备份失败:', error.message);
        }

        try {
            // 执行git操作
            if (isForce) {
                console.log('执行强制更新...');
                await execAsync(`git -C "${projectRoot}" checkout .`);
            }

            // 标记状态为需要恢复
            await redis.set(REDIS_UPDATE_STATUS, 'restoring');

            console.log('执行git pull...');
            const { stdout } = await execAsync(`git -C "${projectRoot}" pull --no-rebase`);

            // 恢复配置文件
            if (configBackedUp) {
                console.log('开始恢复配置文件...');
                await copyConfig(tempDir, configDir);
            }

            // 清理所有临时文件和状态
            await cleanupUpdate(tempDir);

            if (stdout.includes('Already up to date') || stdout.includes('已经是最新')) {
                return new Response(JSON.stringify({
                    success: true,
                    message: '已经是最新版本'
                }), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            return new Response(JSON.stringify({
                success: true,
                message: '更新成功'
            }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (error) {
            // 如果git操作失败，也尝试恢复配置文件
            if (configBackedUp) {
                try {
                    await copyConfig(tempDir, configDir);
                    console.log('git操作失败，但配置文件已恢复');
                } catch (restoreError) {
                    console.error('恢复配置文件失败:', restoreError.message);
                }
            }

            await cleanupUpdate(tempDir);

            const errorMessage = handleGitError(error, error.stderr);
            return new Response(JSON.stringify({
                success: false,
                message: errorMessage
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

    } catch (error) {
        console.error('更新过程出错:', error);

        // 确保清理所有临时状态
        const paths = JSON.parse(await redis.get(REDIS_UPDATE_PATH) || '{}');
        if (paths.tempDir) {
            await cleanupUpdate(paths.tempDir);
        }

        return new Response(JSON.stringify({
            success: false,
            message: '更新过程出错：' + (error.message || '未知错误')
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

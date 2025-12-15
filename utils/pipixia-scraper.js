import axios from "axios";

/**
 * 皮皮虾原生爬虫 - 无水印视频解析
 */
class PipixiaScraper {

    constructor() { }

    async parse(url) {
        try {
            // 处理短链接重定向
            let finalUrl = url;
            if (url.includes('/s/')) {
                const response = await axios.get(url, {
                    maxRedirects: 5,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                finalUrl = response.request.res.responseUrl || response.config.url;
            }

            // 提取item_id
            const itemIdMatch = finalUrl.match(/item\/(\d+)/);
            if (!itemIdMatch) {
                throw new Error('无法从URL中提取item_id');
            }

            // 获取页面HTML
            const response = await axios.get(finalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                }
            });

            // 提取RENDER_DATA中的JSON
            const renderDataMatch = response.data.match(/<script id="RENDER_DATA" type="application\/json">(.+?)<\/script>/);
            if (!renderDataMatch) {
                throw new Error('未找到RENDER_DATA数据');
            }

            // 解析JSON数据
            const data = JSON.parse(decodeURIComponent(renderDataMatch[1]));
            const itemDetail = data.ppxItemDetail?.item;
            if (!itemDetail) {
                throw new Error('未找到item数据');
            }

            // 提取视频URL（优先无水印）
            let videoUrl = '';
            const author = itemDetail.author;
            const share = itemDetail.share;

            // 方法1: 从评论item中获取无水印视频（推荐）
            if (data.ppxCellComment?.cell_comments) {
                for (const cell of data.ppxCellComment.cell_comments) {
                    if (cell.comment_info?.item?.video) {
                        const itemVideo = cell.comment_info.item.video;
                        if (itemVideo.video_high?.url_list?.length > 0) {
                            videoUrl = itemVideo.video_high.url_list[0].url;
                            console.log('[皮皮虾] 无水印视频');
                            break;
                        }
                    }
                }
            }

            // 方法2: 降级方案
            if (!videoUrl) {
                if (itemDetail.video?.origin_video_download?.url_list?.length > 0) {
                    videoUrl = itemDetail.video.origin_video_download.url_list[0].url;
                } else if (itemDetail.video?.video_download?.url_list?.length > 0) {
                    videoUrl = itemDetail.video.video_download.url_list[0].url;
                }
            }

            // 提取评论
            const comments = data.ppxCellComment?.cell_comments
                ?.filter(cell => cell.comment_info)
                .map(cell => {
                    const comment = cell.comment_info;
                    return {
                        id: comment.comment_id_str,
                        content: comment.text,
                        user: {
                            id: comment.user?.user_id_str || comment.user?.id_str,
                            name: comment.user?.name || comment.user?.nickname,
                            avatar: comment.user?.avatar_url || comment.user?.avatar?.url_list?.[0]?.url
                        },
                        createTime: comment.create_time,
                        likeCount: comment.digg_count || 0,
                        replyCount: comment.reply_count || 0
                    };
                }) || [];

            // 提取邀请人并构造标题
            let inviterName = null;
            if (data.ppxUserDetail?.user?.name) {
                inviterName = data.ppxUserDetail.user.name;
            }

            let customTitle = share?.title || '皮皮虾视频';
            // 只有真正找到邀请人时才替换标题
            if (inviterName && customTitle.includes('的这个内容太有意思了')) {
                customTitle = `这个内容太有意思了，${inviterName}分享给你，快点开看看！`;
            }

            return {
                success: true,
                itemId: itemDetail.item_id_str,
                title: customTitle,
                inviter: inviterName,
                author: {
                    id: author?.id_str,
                    name: author?.name,
                    avatar: author?.avatar?.url_list?.[0]?.url
                },
                video: {
                    url: videoUrl,
                    cover: itemDetail.cover?.url_list?.[0]?.url,
                    duration: itemDetail.duration,
                    width: itemDetail.video?.video_width,
                    height: itemDetail.video?.video_height
                },
                stats: {
                    likes: itemDetail.stats?.like_count,
                    comments: itemDetail.stats?.comment_count,
                    shares: itemDetail.stats?.share_count,
                    views: itemDetail.stats?.play_count
                },
                comments: comments
            };

        } catch (error) {
            console.error(`[R插件][皮皮虾爬虫] 解析失败: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default PipixiaScraper;

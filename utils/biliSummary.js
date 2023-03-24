/**
 * 获取gpt提取视频信息的文字
 * @param title 视频标题
 * @param aid
 * @param cid
 * @param biliSessData
 * @param shouldShowTimestamp 是否在每段字幕前面加入时间标识
 * @returns {Promise<string>}
 */
export async function getBiliGptInputText(title, aid, cid, biliSessData, shouldShowTimestamp = false) {
    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
        Host: "api.bilibili.com",
        Cookie: `SESSDATA=${biliSessData}`,
    };
    const commonConfig = {
        method: "GET",
        cache: "no-cache",
        headers,
        referrerPolicy: "no-referrer",
    };
    // https://api.bilibili.com/x/player/v2?aid=438937138&cid=1066979272
    const resp = await fetch(
        `https://api.bilibili.com/x/player/v2?aid=${aid}&cid=${cid}`,
        commonConfig,
    );
    const subtitles = (await resp.json()).data.subtitle.subtitles;
    const res = await fetch(`http:${subtitles[0]?.subtitle_url}`);
    if (_.isUndefined(res)) {
        throw new Error("");
    }
    const subtitlesData = (await res.json()).body;
    const subtitleTimestamp = reduceBilibiliSubtitleTimestamp(subtitlesData, shouldShowTimestamp);
    const inputText = getSmallSizeTranscripts(subtitleTimestamp, subtitleTimestamp);
    const videoConfig = {
        showEmoji: false,
    };
    const userPrompt = shouldShowTimestamp
        ? getUserSubtitleWithTimestampPrompt(title, inputText, videoConfig)
        : getUserSubtitlePrompt(title, inputText, videoConfig);
    return userPrompt;
}

// 以下拼接算法来自：https://github.com/JimmyLv/BibiGPT
function reduceBilibiliSubtitleTimestamp(subtitles = [], shouldShowTimestamp) {
    return reduceSubtitleTimestamp(
        subtitles,
        i => i.from,
        i => i.content,
        shouldShowTimestamp,
    );
}
function reduceSubtitleTimestamp(subtitles, getStart, getText, shouldShowTimestamp) {
    // 把字幕数组总共分成 20 组
    const TOTAL_GROUP_COUNT = 30;
    // 如果字幕不够多，就每7句话合并一下
    const MINIMUM_COUNT_ONE_GROUP = 7;
    const eachGroupCount =
        subtitles.length > TOTAL_GROUP_COUNT
            ? subtitles.length / TOTAL_GROUP_COUNT
            : MINIMUM_COUNT_ONE_GROUP;

    return subtitles.reduce((accumulator, current, index) => {
        // 计算当前元素在哪一组
        const groupIndex = Math.floor(index / MINIMUM_COUNT_ONE_GROUP);

        // 如果是当前组的第一个元素，初始化这一组的字符串
        if (!accumulator[groupIndex]) {
            accumulator[groupIndex] = {
                // 5.88 -> 5.9
                // text: current.start.toFixed() + ": ",
                index: groupIndex,
                s: getStart(current),
                text: shouldShowTimestamp ? getStart(current) + " - " : "",
            };
        }

        // 将当前元素添加到当前组的字符串末尾
        accumulator[groupIndex].text = accumulator[groupIndex].text + getText(current) + " ";

        return accumulator;
    }, []);
}

function getSmallSizeTranscripts(newTextData, oldTextData, byteLimit = 6200) {
    const text = newTextData
        .sort((a, b) => a.index - b.index)
        .map(t => t.text)
        .join(" ");
    const byteLength = getByteLength(text);

    if (byteLength > byteLimit) {
        const filtedData = filterHalfRandomly(newTextData);
        return getSmallSizeTranscripts(filtedData, oldTextData, byteLimit);
    }

    let resultData = newTextData.slice();
    let resultText = text;
    let lastByteLength = byteLength;

    for (let i = 0; i < oldTextData.length; i++) {
        const obj = oldTextData[i];
        if (itemInIt(newTextData, obj.text)) {
            continue;
        }

        const nextTextByteLength = getByteLength(obj.text);
        const isOverLimit = lastByteLength + nextTextByteLength > byteLimit;
        if (isOverLimit) {
            const overRate = (lastByteLength + nextTextByteLength - byteLimit) / nextTextByteLength;
            const chunkedText = obj.text.substring(0, Math.floor(obj.text.length * overRate));
            resultData.push({ text: chunkedText, index: obj.index });
        } else {
            resultData.push(obj);
        }
        resultText = resultData
            .sort((a, b) => a.index - b.index)
            .map(t => t.text)
            .join(" ");
        lastByteLength = getByteLength(resultText);
    }

    return resultText;
}

function filterHalfRandomly(arr) {
    const filteredArr = [];
    const halfLength = Math.floor(arr.length / 2);
    const indicesToFilter = new Set();

    // 随机生成要过滤掉的元素的下标
    while (indicesToFilter.size < halfLength) {
        const index = Math.floor(Math.random() * arr.length);
        if (!indicesToFilter.has(index)) {
            indicesToFilter.add(index);
        }
    }

    // 过滤掉要过滤的元素
    for (let i = 0; i < arr.length; i++) {
        if (!indicesToFilter.has(i)) {
            filteredArr.push(arr[i]);
        }
    }

    return filteredArr;
}

function getByteLength(text) {
    return unescape(encodeURIComponent(text)).length;
}

function itemInIt(textData, text) {
    return textData.find(t => t.text === text) !== undefined;
}

function getUserSubtitlePrompt(title, transcript, videoConfig) {
    const videoTitle = title?.replace(/\n+/g, " ").trim();
    const videoTranscript = limitTranscriptByteLength(transcript).replace(/\n+/g, " ").trim();
    const language = "zh-CN";
    const sentenceCount = videoConfig.sentenceNumber || 7;
    const emojiTemplateText = videoConfig.showEmoji ? "[Emoji] " : "";
    const emojiDescriptionText = videoConfig.showEmoji
        ? "Choose an appropriate emoji for each bullet point. "
        : "";
    const shouldShowAsOutline = Number(videoConfig.outlineLevel) > 1;
    const wordsCount = videoConfig.detailLevel ? (Number(videoConfig.detailLevel) / 100) * 2 : 15;
    const outlineTemplateText = shouldShowAsOutline ? `\n    - Child points` : "";
    const outlineDescriptionText = shouldShowAsOutline
        ? `Use the outline list, which can have a hierarchical structure of up to ${videoConfig.outlineLevel} levels. `
        : "";
    const prompt = `Your output should use the following template:\n## Summary\n## Highlights\n- ${emojiTemplateText}Bulletpoint${outlineTemplateText}\n\nYour task is to summarise the text I have given you in up to ${sentenceCount} concise bullet points, starting with a short highlight, each bullet point is at least ${wordsCount} words. ${outlineDescriptionText}${emojiDescriptionText}Use the text above: {{Title}} {{Transcript}}.\n\nReply in ${language} Language.`;

    return `Title: "${videoTitle}"\nTranscript: "${videoTranscript}"\n\nInstructions: ${prompt}`;
}

export function getUserSubtitleWithTimestampPrompt(title, transcript, videoConfig) {
    const videoTitle = title?.replace(/\n+/g, " ").trim();
    const videoTranscript = limitTranscriptByteLength(transcript).replace(/\n+/g, " ").trim();
    const language = "zh-CN";
    const sentenceCount = videoConfig.sentenceNumber || 7;
    const emojiTemplateText = videoConfig.showEmoji ? "[Emoji] " : "";
    const wordsCount = videoConfig.detailLevel ? (Number(videoConfig.detailLevel) / 100) * 2 : 15;
    const promptWithTimestamp = `Act as the author and provide exactly ${sentenceCount} bullet points for the text transcript given in the format [seconds] - [text] \nMake sure that:\n    - Please start by summarizing the whole video in one short sentence\n    - Then, please summarize with each bullet_point is at least ${wordsCount} words\n    - each bullet_point start with \"- \" or a number or a bullet point symbol\n    - each bullet_point should has the start timestamp, use this template: - seconds - ${emojiTemplateText}[bullet_point]\n    - there may be typos in the subtitles, please correct them\n    - Reply all in ${language} Language.`;
    const videoTranscripts = limitTranscriptByteLength(JSON.stringify(videoTranscript));
    return `Title: ${videoTitle}\nTranscript: ${videoTranscripts}\n\nInstructions: ${promptWithTimestamp}`;
}

function limitTranscriptByteLength(str, byteLimit = 6200) {
    const utf8str = unescape(encodeURIComponent(str));
    const byteLength = utf8str.length;
    if (byteLength > byteLimit) {
        const ratio = byteLimit / byteLength;
        const newStr = str.substring(0, Math.floor(str.length * ratio));
        return newStr;
    }
    return str;
}

import Bili from "./contents/bili.jsx";
import Generic from "./contents/generic.jsx";
import Home from "./contents/home.jsx";
import Ncm from "./contents/ncm.jsx";
import Tiktok from "./contents/tiktok.jsx";
import Weekly from "./contents/weekly.jsx";
import Youtube from "./contents/youtube.jsx";

export function Content({ activeItem }) {

    // 使用对象映射内容，以便于后期扩展和维护
    const contentMap = {
        "总控制台": <Home />,
        "通用及杂项": <Generic />,
        "哔哩哔哩控制台": <Bili />,
        "抖音控制台": <Tiktok />,
        "网易云控制台": <Ncm />,
        "油管控制台": <Youtube />,
        "周刊预览": <Weekly />
    };

    return (
        <div>
            { contentMap[activeItem] || contentMap["总控制台"] }
        </div>
    );
}

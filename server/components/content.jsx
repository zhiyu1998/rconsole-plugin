import { SIDEBAR_ITEMS } from "../constants/sidebar.js";

export function Content({ activeItem }) {
    // 查找当前激活项
    const currentItem = SIDEBAR_ITEMS.find(item => item.name === activeItem);

    // 如果没找到则返回总控制台
    return (
        <div>
            {currentItem?.component || SIDEBAR_ITEMS[0].component}
        </div>
    );
}

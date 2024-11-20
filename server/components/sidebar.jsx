"use client"
import { useState } from "react";
import { SIDEBAR_ITEMS } from "../constants/sidebar.js";
import { useDrawer } from "../contexts/drawer-context.js";
import { Content } from "./content.jsx";

export default function Sidebar() {
    const { isDrawerOpen, toggleDrawer } = useDrawer();

    const [activeItem, setActiveItem] = useState("总控制台");

    // 定义当前主题状态
    const [theme, setTheme] = useState("light");

    // 切换主题的函数
    const toggleTheme = (newTheme) => {
        setTheme(newTheme); // 更新状态
        document.documentElement.setAttribute("data-theme", newTheme); // 更新主题属性
    };

    return (
        <div className="drawer">
            <input id="my-drawer" type="checkbox" className="drawer-toggle hidden" checked={ isDrawerOpen } readOnly/>

            <div className="drawer-content">
                <Content activeItem={activeItem} />
            </div>

            <div className="drawer-side fixed top-16 left-0 h-[calc(100%-4rem)]">
                <label htmlFor="my-drawer" aria-label="close sidebar" className="drawer-overlay"
                       onClick={ toggleDrawer }></label>
                <ul className="menu bg-base-200 text-base-content w-80 p-4 h-full overflow-y-auto">
                    {SIDEBAR_ITEMS.map((item) => (
                        <li key={item.name} onClick={() => setActiveItem(item.name)}>
                            <a className={activeItem === item.name ? "active" : ""} onClick={() => toggleTheme(item.theme)}>
                                {item.icon}
                                {item.name}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

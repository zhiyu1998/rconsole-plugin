"use client"
import { useState, useEffect } from 'react';
import { useDrawer } from "../contexts/drawer-context.js";
import { getUserInfo } from "../utils/napact.js";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Header () {

    const { toggleDrawer } = useDrawer();

    const [user, setUser] = useState({ user_id: null, nickname: '' });

    useEffect(() => {
        getUserInfo().then(setUser);
    }, []);

    return (
        <div className="navbar bg-base-100 p-3">

            <div className="navbar-start">
                <button className="btn btn-square btn-ghost" onClick={ toggleDrawer }>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        className="inline-block h-5 w-5 stroke-current">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </button>
            </div>
            <div className="navbar-center">
            <div className="avatar">
                    <div className="w-10 rounded-full">
                        <img
                            alt="Logo"
                            src="https://s2.loli.net/2024/08/19/ty5K6P3hsAaXC47.webp"/>
                    </div>
                </div>
                <a className="btn btn-ghost text-xl">R插件控制台</a>
            </div>
            <div className="navbar-end">
                <ThemeToggle />
                <div className="flex flex-row">
                    <div tabIndex={ 0 } role="button" className="btn btn-ghost btn-circle avatar mr-2">
                        <div className="w-10 rounded-full">
                            <img
                                alt="头像"
                                src={`http://q1.qlogo.cn/g?b=qq&nk=${user.user_id}&s=100`}/>
                        </div>
                    </div>
                    <div className="mt-1.5">
                        <div className="font-bold">{user.nickname || "未获取"}</div>
                        <div className="text-sm opacity-50">{user.user_id || "NaN"}</div>
                    </div>
                </div>
            </div>
        </div>
    )
};

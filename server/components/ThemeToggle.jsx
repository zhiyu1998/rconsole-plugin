import React, { useState } from 'react';

function ThemeToggle() {
    // 用于保存主题状态，默认为“light”主题
    const [isDarkTheme, setIsDarkTheme] = useState(false);

    // 切换主题时的处理函数
    const handleThemeChange = () => {
        setIsDarkTheme(!isDarkTheme);
    };

    return (
        <input
            type="checkbox"
            checked={isDarkTheme}
            onChange={handleThemeChange}
            className="toggle theme-controller"
            value={isDarkTheme ? 'dark' : 'light'}
        />
    );
}

export default ThemeToggle;

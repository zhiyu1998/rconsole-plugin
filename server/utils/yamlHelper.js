export const readYamlConfig = async () => {
    try {
        const response = await fetch('/r/api/config');
        if (!response.ok) throw new Error('获取配置失败');
        return await response.json();
    } catch (error) {
        console.error('读取配置文件失败:', error);
        return null;
    }
};

export const updateYamlConfig = async (updates) => {
    try {
        const response = await fetch('/r/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('更新配置失败');
        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('更新配置文件失败:', error);
        return false;
    }
};
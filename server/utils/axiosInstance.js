import axios from 'axios';

// 创建 Axios 实例
const axiosInstance = axios.create({
    baseURL: 'http://192.168.31.230:2537', // 基础请求地址
    timeout: 5000, // 设置请求超时时间，可根据需要调整
    headers: {
        'Content-Type': 'application/json',
    },
});

// 请求拦截器
axiosInstance.interceptors.request.use(
    (config) => {
        // 这里可以添加请求前的处理逻辑，例如添加 token
        // const token = localStorage.getItem('token');
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        return config;
    },
    (error) => {
        // 请求错误处理
        return Promise.reject(error);
    }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
    (response) => {
        // 响应成功处理
        return response.data;
    },
    (error) => {
        // 响应错误处理
        if (error.response) {
            // 服务器返回的错误
            console.error('Error:', error.response.status, error.response.data);
        } else if (error.request) {
            // 请求未收到服务器响应
            console.error('No response received:', error.request);
        } else {
            // 设置请求时发生的错误
            console.error('Request setup error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;

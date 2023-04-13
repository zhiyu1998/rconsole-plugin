export default class TokenBucket {
    constructor(rate, capacity, interval = 1, isMinute = false) {
        this.interval = interval; // 生成令牌的时间间隔
        this.rate = isMinute ? rate / 60 : rate; // 修改为每分钟生成的令牌数量
        this.capacity = capacity; // 令牌容量
        this.tokens = capacity; // 令牌容量
        this.tokens = new Map(); // 使用 Map 存储每个用户的令牌桶
        this.lastTime = new Date().getTime(); // 上次使用时间

        /**
         * 核心算法
         * @param tokens
         * @param capacity
         * @param rate
         * @param lastTime
         * @param interval
         * @param isMinute
         * @return {{lastTime: number, tokens: number}}
         */
         this.updateTokens = (tokens, capacity, rate, lastTime, interval) => {
            // 计算从上次请求到现在经过的时间
            const now = new Date().getTime();
            const elapsed = now - lastTime;
            // 根据时间计算出新生成的令牌数量
            const addedTokens = elapsed * (rate / interval / 1000); // 修改为每分钟生成的令牌数量
            tokens = Math.min(tokens + addedTokens, capacity);
            lastTime = now;
            return { tokens, lastTime };
        }
    }

    /**
     * 消耗令牌-一个桶
     * @param count
     * @return {boolean}
     */
    consumeSingle(count = 1) {
        const { tokens, lastTime } = this.updateTokens(this.tokens, this.capacity, this.rate, this.lastTime, this.interval);
        // 更新令牌桶中的令牌数量
        this.tokens = tokens;

        // 判断请求是否能够被处理（即令牌桶中是否有足够的令牌）
        if (count <= this.tokens) {
            this.tokens -= count;
            return true; // 返回 true 表示请求被处理
        } else {
            return false; // 返回 false 表示请求被限流
        }
    }

    /**
     * 消耗令牌
     * @param id     用户id
     * @param count  请求次数
     * @return {boolean}
     */
    consume(id, count = 1) {
        const { tokens: userTokens, lastTime: userLastTime } = this.tokens.get(id) || { tokens: this.capacity, lastTime: new Date().getTime() };
        const { tokens, lastTime } = this.updateTokens(userTokens, this.capacity, this.rate, userLastTime, this.interval);
        // 更新令牌桶中的令牌数量
        this.tokens.set(id, { tokens, lastTime });

        // 判断请求是否能够被处理（即令牌桶中是否有足够的令牌）
        if (count <= tokens) {
            this.tokens.set(id, { tokens: tokens - count, lastTime });
            return true;
        } else {
            return false;
        }
    }

    /**
     * 重置令牌
     * @param newCapacity
     */
    resetCapacity(newCapacity) {
        if (newCapacity >= this.tokens) {
            this.capacity = newCapacity;
            this.tokens = newCapacity;
        } else {
            throw new Error('分配少于当前的容量！');
        }
    }
}
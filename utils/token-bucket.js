export default class TokenBucket {
    constructor(rate, capacity) {
        this.rate = rate / 60; // 修改为每分钟生成的令牌数量
        this.capacity = capacity;
        this.tokens = capacity;
        this.tokens = new Map(); // 使用 Map 存储每个用户的令牌桶
        this.lastTime = new Date().getTime();
    }

    /**
     * 消耗令牌
     * @param id     用户id
     * @param count  请求次数
     * @return {boolean}
     */
    consume(id, count = 1) {
        const now = new Date().getTime();
        const elapsed = now - this.lastTime;
        const addedTokens = elapsed * (this.rate / 1000);
        this.lastTime = now;

        // 获取用户的令牌桶，如果不存在则创建一个新的令牌桶
        let userTokens = this.tokens.get(id);
        if (!userTokens) {
            userTokens = { tokens: this.capacity, lastTime: now };
            this.tokens.set(id, userTokens);
        }

        // 更新用户的令牌桶中的令牌数量
        userTokens.tokens = Math.min(
            userTokens.tokens + addedTokens,
            this.capacity
        );
        userTokens.lastTime = now;

        // 判断是否有足够的令牌
        if (count <= userTokens.tokens) {
            userTokens.tokens -= count;
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
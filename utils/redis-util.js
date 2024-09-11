/**
 * 判断某个key是否存在
 * @param key
 * @returns {Promise<boolean>}
 * @example
 * const exists = await redisExistKey('myKey');
 * console.log(exists); // true or false
 */
export async function redisExistKey(key) {
    return redis.exists(key);
}

/**
 * 获取某个key的值
 * @param key
 * @returns {Promise<Object>}
 * @example
 * const value = await redisGetKey('myKey');
 * console.log(value); // { ... }
 */
export async function redisGetKey(key) {
    return JSON.parse(await redis.get(key));
}

/**
 * 为某个key设置值，value必须是个键值对
 * @param key
 * @param value
 * @returns {Promise<*>}
 * @example
 * await redisSetKey('myKey', { foo: 'bar' });
 */
export async function redisSetKey(key, value = {}) {
    return redis.set(
        key,
        JSON.stringify(value),
    );
}

/**
 * 判断是否存在这个key然后再取值，如果没有就返回null
 * @param key
 * @returns {Promise<Object|Array>}
 * @example
 * const value = await redisExistAndGetKey('myKey');
 * console.log(value); // { ... } or null
 */
export async function redisExistAndGetKey(key) {
    if (await redisExistKey(key)) {
        return redisGetKey(key);
    }
    return null;
}

/**
 * 在某个 key 的末尾插入一个对象
 * @param key
 * @param obj
 * @returns {Promise<void>}
 * @example
 * await redisExistAndInsertObject('myKey', { newKey: 'newValue' });
 */
export async function redisExistAndInsertObject(key, obj) {
    let objs = await redisExistAndGetKey(key);
    if (objs) {
        objs = { ...objs, ...obj };
        await redisSetKey(key, objs);
    } else {
        await redisSetKey(key, obj);
    }
}

/**
 * 更新Redis中某个对象的值
 * @param key
 * @param updateKey
 * @param updateObj
 * @returns {Promise<void>}
 * @example
 * await redisExistAndUpdateObject('myKey', 'updateKey', { foo: 'bar' });
 */
export async function redisExistAndUpdateObject(key, updateKey, updateObj) {
    let objs = await redisExistAndGetKey(key);
    if (Object.keys(objs).includes(updateKey)) {
        objs[updateKey] = updateObj;
        await redisSetKey(key, objs);
    }
}

/**
 * 删除某个key
 * @param key
 * @returns {Promise<number>}
 * @example
 * const result = await redisDeleteKey('myKey');
 * console.log(result); // 1 if key was deleted, 0 if key did not exist
 */
export async function redisDeleteKey(key) {
    return redis.del(key);
}

/**
 * 获取所有的key
 * @returns {Promise<Array<string>>}
 * @example
 * const keys = await redisGetAllKeys();
 * console.log(keys); // ['key1', 'key2', ...]
 */
export async function redisGetAllKeys() {
    return redis.keys('*');
}

/**
 * 设置某个key的过期时间
 * @param key
 * @param seconds
 * @returns {Promise<boolean>}
 * @example
 * const result = await redisExpireKey('myKey', 3600);
 * console.log(result); // true if timeout was set, false if key does not exist
 */
export async function redisExpireKey(key, seconds) {
    return redis.expire(key, seconds);
}

/**
 * 获取某个key的剩余生存时间
 * @param key
 * @returns {Promise<number>}
 * @example
 * const ttl = await redisTTLKey('myKey');
 * console.log(ttl); // time to live in seconds, -1 if key does not have timeout, -2 if key does not exist
 */
export async function redisTTLKey(key) {
    return redis.ttl(key);
}
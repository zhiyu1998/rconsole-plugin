// 批量/单个添加
function add (key, values) {
    if (typeof values instanceof Array) {
        values.forEach(async (value) => {
            await redis.set(key, value)
        })
    } else {
        redis.set(key, values)
    }
}

// 批量/单个删除
function remove (key, values) {
    if (typeof values instanceof Array) {
        values.forEach(async (values) => {
            await redis.del(key, values)
        })
    } else {
        redis.del(key, values)
    }
}

// 批量/单个查询
function get (key) {
    return redis.get(key)
}

export { get, remove, add }
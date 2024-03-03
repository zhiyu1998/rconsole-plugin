// Base62 encode function in JavaScript
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const base62_encode = (number) => {
    if (number === 0) return '0';
    let result = '';
    while (number > 0) {
        result = ALPHABET[number % 62] + result;
        number = Math.floor(number / 62);
    }
    return result;
};

// Convert mid to id
export const mid2id = (mid) => {
    mid = mid.toString().split('').reverse().join(''); // Reverse the input string
    const size = Math.ceil(mid.length / 7);
    let result = [];

    for (let i = 0; i < size; i++) {
        let s = mid.slice(i * 7, (i + 1) * 7).split('').reverse().join(''); // Chunk and reverse each chunk
        s = base62_encode(parseInt(s, 10)); // Encode each chunk using base62
        if (i < size - 1 && s.length < 4) {
            // Pad with leading zeros if necessary
            s = '0'.repeat(4 - s.length) + s;
        }
        result.push(s);
    }

    result.reverse(); // Reverse the result array to maintain order
    return result.join(''); // Join the array into a single string
};

import md5 from 'md5';

export const getDS = () => {
    const salt = "ZSHlXeQUBis52qD1kEgKt5lUYed4b7Bb";
    const lettersAndNumbers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

    const i = Math.floor(Date.now() / 1000);
    let r = ""
    for (let i; i < 6; i++) {
        r += lettersAndNumbers[Math.floor(Math.random() * lettersAndNumbers.length)]
    }
    const c = md5(`salt=${ salt }&t=${ i }&r=${ r }`);
    return `${ i },${ r },${ c }`;
}
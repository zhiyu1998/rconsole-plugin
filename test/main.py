import asyncio
import re
import time

import aiohttp
import motor
from bs4 import BeautifulSoup

url = 'https://www.tuiimg.com/meinv/'

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.35",
    'Pragma': 'no-cache',
    'Accept-Encoding': 'gzip, deflate',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    "Content-Type": "text/html;charset=utf-8"}

# 请求分类页面的并发限制（不要一次请求太多分类）
sem_page = asyncio.Semaphore(5)


async def fetch_content(url):
    '''
    根据url获取内容
    :param url: 网页的url
    :return:
    '''
    async with sem_page:
        print(f'开始解析链接：{url}')
        max_retries = 3
        attempt = 0
        while True:
            try:
                async with aiohttp.ClientSession(
                        headers=headers, connector=aiohttp.TCPConnector(ssl=False)
                ) as session:
                    async with session.get(url, timeout=10) as resp:
                        return await resp.text()
                break
            except (
                    asyncio.TimeoutError
            ):
                if attempt < max_retries:
                    print("解析链接异常，稍后自动重试：{} times:{}".format(url, attempt))
                    attempt += 1
                else:
                    raise


async def page_pic(connect, pic_page):
    '''
    处理一套图片，分文件夹存放
    :param connect:  Mongodb连接
    :param pic_page: 一套图片的url
    :return:
    '''
    bs = BeautifulSoup(pic_page, 'lxml')
    div = bs.find('div', {'class': "content"})
    img_temp_link = div.find('img')['src']
    img_base_link = img_temp_link[0:-5]
    all_text = bs.find('i', id='allbtn').get_text()
    pattern = re.compile("\((.*?)\)")
    total = pattern.search(all_text).group(1).split("/")[1]
    img_urls = []
    for i in range(1, int(total) + 1):
        img_url = img_base_link + str(i) + '.jpg'
        img_urls.append(img_url)
    task = [insert_url(connect, url_temp) for url_temp in img_urls]
    await asyncio.gather(*task)


async def page_main(url):
    '''
    单页下载
    :param url: 单页的url
    :return: None
    '''
    connect = build_connect()
    main_page_text = await fetch_content(url)
    bs = BeautifulSoup(main_page_text, 'lxml')
    a_all = bs.find_all('a', {'class': 'pic'})
    page_urls = []
    for a in a_all:
        page_urls.append(a['href'])
    tasks = [fetch_content(pic_url) for pic_url in page_urls]
    pic_pages = await asyncio.gather(*tasks)
    pics = [page_pic(connect, pic_page) for pic_page in pic_pages]
    await asyncio.gather(*pics)


async def main():
    '''
    遍历所有页面的url进行下载
    :return:
    '''
    # await target_folder()
    start = time.time()
    mainPageText = await fetch_content(url)
    bs = BeautifulSoup(mainPageText, 'lxml')
    page_count = bs.find('div', {'class', 'page'}).find('a', {'class', "end"}).get_text()
    page_urls = []
    for i in range(1, int(page_count) + 1):
        page_url = f'{url}list_{i}.html'
        page_urls.append(page_url)
    tasks = [page_main(page_url) for page_url in page_urls]
    await asyncio.gather(*tasks)
    end = time.time()
    print(f"耗时：{end - start:.2f}秒")


# 单例建立MongoDB连接
def build_connect():
    client = motor.motor_tornado.MotorClient('localhost', 27017)
    db = client.test
    return db.temp


def insert_url(connect, url_temp):
    query = {'url': url_temp}
    return connect.update_one(query, {"$set": query}, True)


if __name__ == '__main__':
    # linux下用此方法
    # asyncio.run(main())
    # windows下上面的方法会报错（会在运行完成后报错，不影响下载），可以换成用下面这两行
    loop = asyncio.get_event_loop()
    loop.run_until_complete(main())

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.static('public'));

// ======================================================
// 核心配置：资源采集接口 (API) - 多路线支持
// ======================================================

// 多路线 API 配置
const API_ROUTES = {
    1: 'http://cj.ffzyapi.com/api.php/provide/vod/', // 线路1：非凡资源 (速度快，m3u8直连，推荐)
    2: 'https://cj.lziapi.com/api.php/provide/vod/',  // 线路2：量子资源 (备用)
    3: 'https://api.tiankongapi.com/api.php/provide/vod/' // 线路3：天空资源 (老牌)
};

// 搜索代理接口：前端找我要，我去找资源站要
app.get('/search', async (req, res) => {
    const wd = req.query.wd; // 获取剧名
    const rt = parseInt(req.query.rt) || 1; // 获取路线，默认1

    // 输入验证：检查关键词
    if (!wd || typeof wd !== 'string' || wd.trim().length === 0) {
        return res.status(400).json({ error: '请输入搜索关键词' });
    }
    if (wd.length > 50) {
        return res.status(400).json({ error: '搜索关键词过长，请控制在50字以内' });
    }

    // 输入验证：检查路线号
    if (![1, 2, 3].includes(rt)) {
        return res.status(400).json({ error: '无效的路线号，请使用 1、2 或 3' });
    }

    console.log(`正在后台搜索: ${wd} (路线${rt})...`);

    try {
        // 关键一步：后端发起请求 (浏览器拦不住 Node.js)
        // 尝试使用不同的参数组合，获取包含播放地址的数据
        const response = await axios.get(API_ROUTES[rt], {
            params: {
                ac: 'detail', // 尝试使用 detail 动作，获取详情（可能包含播放地址）
                wd: wd,       // 搜索关键词
                pg: 1,        // 页码
                limit: 20     // 每页数量
            },
            timeout: 10000 // 10秒超时设定，增加超时时间以提高成功率
        });

        // 打印日志，查看返回数据的结构
        console.log(`搜索结果 (路线${rt}):`);
        console.log(`总数量: ${response.data.total}`);
        if (response.data.list && response.data.list.length > 0) {
            const firstItem = response.data.list[0];
            console.log(`第一个结果: ${firstItem.vod_name}`);
            console.log(`播放源: ${firstItem.vod_play_from}`);
            console.log(`是否包含播放地址: ${'vod_play_url' in firstItem}`);
            if ('vod_play_url' in firstItem) {
                console.log(`播放地址长度: ${firstItem.vod_play_url.length}`);
                // 打印完整播放地址，了解所有源
                console.log(`完整播放地址: ${firstItem.vod_play_url}`);
            }
            // 打印完整的字段列表
            console.log(`包含的字段: ${Object.keys(firstItem).join(', ')}`);
        }

        // 把拿到的一大堆数据，原封不动发给前端
        res.json(response.data);
    } catch (error) {
        console.error('搜索失败:', error.message);
        // 如果出错，尝试使用原来的 ac=list 参数
        try {
            console.log(`尝试使用 ac=list 参数重新搜索...`);
            const response = await axios.get(API_ROUTES[rt], {
                params: {
                    ac: 'list', // 原来的 list 动作
                    wd: wd      // 搜索关键词
                },
                timeout: 10000 // 10秒超时设定
            });

            // 打印日志
            console.log(`重新搜索结果 (路线${rt}):`);
            console.log(`总数量: ${response.data.total}`);
            if (response.data.list && response.data.list.length > 0) {
                const firstItem = response.data.list[0];
                console.log(`第一个结果: ${firstItem.vod_name}`);
                console.log(`包含的字段: ${Object.keys(firstItem).join(', ')}`);
            }

            // 返回结果
            res.json(response.data);
        } catch (secondError) {
            console.error('重新搜索也失败:', secondError.message);
            // 如果两次都出错，告诉前端为什么
            res.status(500).json({ error: `连接资源站超时，请在 server.js 换个 API 试试或切换路线${rt === '1' ? '2' : '1'}` });
        }
    }
});

// 启动
const PORT = 3000;
app.listen(PORT, () => {
    console.log('---------------------------------------');
    console.log('✅ 后端代理已启动！');
    console.log('👉 浏览器访问: http://localhost:' + PORT);
    console.log('---------------------------------------');
});
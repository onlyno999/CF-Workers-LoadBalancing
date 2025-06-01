export default {
  async fetch(request, env, ctx) {
    // 解析请求 URL
    let url = new URL(request.url);
    const 访问路径 = url.pathname;
    const 访问参数 = url.search;

    // 默认后端域名列表
    let 后端域名 = [
      'www.baidu.com',
      'www.sogou.com',
      'www.so.com'
    ];

    // 若环境变量 HOST 存在，则替换默认列表
    if (env.HOST) 后端域名 = await ADD(env.HOST);

    // 解析测试路径，确保以 "/" 开头
    let 测试路径 = env.PATH || '/';
    if (测试路径.charAt(0) !== '/') 测试路径 = '/' + 测试路径;

    let 响应代码 = env.CODE || '200';

    console.log(`后端数量: ${后端域名.length}\n后端域名: ${后端域名}\n测试路径: ${测试路径}\n响应代码: ${响应代码}`);

    // 定义带超时控制的 fetch 函数
    async function fetchWithTimeout(resource, options = {}) {
      const { timeout = 1618 } = options;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(resource, {
          ...options,
          signal: controller.signal
        });
        return response;
      } finally {
        clearTimeout(id);
      }
    }

    // 并发请求所有后端并收集响应
    const 请求任务列表 = 后端域名.map(async host => {
      try {
        let u = new URL(request.url);
        u.hostname = host;
        u.pathname = 访问路径;
        u.search = 访问参数;

        const response = await fetchWithTimeout(new Request(u, request), { timeout: 1618 });

        if (response.status.toString() !== 响应代码) {
          throw new Error(`状态码不符：${response.status}`);
        }

        const text = await response.text();
        return `=== ${host} ===\n${text}`;
      } catch (err) {
        return `=== ${host} ===\n请求失败：${err.message}`;
      }
    });

    // 等待所有请求完成
    const 结果 = await Promise.all(请求任务列表);
    const 合并内容 = 结果.join('\n\n');

    return new Response(合并内容, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
}

// 解析 HOST 环境变量，返回域名数组
async function ADD(envadd) {
  return envadd
    .replace(/[ \t"'\r\n]+/g, ',')
    .replace(/,+/g, ',')
    .replace(/^,|,$/g, '')
    .split(',');
}

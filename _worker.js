export default {
	// 主函数，处理传入的 HTTP 请求
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		const 访问路径 = url.pathname;
		const 访问参数 = url.search;

		let 后端域名 = ['www.baidu.com', 'www.sogou.com', 'www.so.com'];
		if (env.HOST) 后端域名 = await ADD(env.HOST);

		let 测试路径 = env.PATH || '/';
		if (!测试路径.startsWith('/')) 测试路径 = '/' + 测试路径;

		let 响应代码 = env.CODE || '200';

		console.log(`后端数量: ${后端域名.length}\n后端域名: ${后端域名}\n测试路径: ${测试路径}\n响应代码: ${响应代码}`);

		// 带超时功能的 fetch，并记录耗时
		async function timedFetch(url, timeout = 1618) {
			const controller = new AbortController();
			const signal = controller.signal;
			const id = setTimeout(() => controller.abort(), timeout);

			const start = Date.now();
			try {
				const response = await fetch(url, { signal });
				const duration = Date.now() - start;
				return { response, duration, success: true };
			} catch (e) {
				return { response: null, duration: timeout, success: false, error: e };
			} finally {
				clearTimeout(id);
			}
		}

		// 测试所有后端，选择响应最短且状态码匹配的
		async function getFastestValidBackend(request, 后端域名列表) {
			const 测试请求列表 = 后端域名列表.map(async host => {
				const 测试url = new URL(request.url);
				测试url.hostname = host;
				测试url.pathname = 测试路径.split('?')[0];
				测试url.search = 测试路径.includes('?') ? "?" + 测试路径.split('?')[1] : "";

				const result = await timedFetch(测试url);
				return { host, ...result };
			});

			const 测试结果 = await Promise.all(测试请求列表);

			// 筛选出成功、状态码符合要求的
			const 合格后端 = 测试结果
				.filter(item => item.success && item.response.status.toString() === 响应代码)
				.sort((a, b) => a.duration - b.duration);

			if (合格后端.length === 0) {
				console.log(`没有可用后端，错误列表:\n`, 测试结果.map(r => `${r.host}: ${r.success ? r.response.status : r.error}`));
				return new Response('所有后端都不可用！', {
					status: 404,
					headers: { 'content-type': 'text/plain; charset=utf-8' },
				});
			}

			const 最快 = 合格后端[0];
			console.log(`使用后端: ${最快.host}，耗时: ${最快.duration}ms`);

			// 构造转发请求
			const 真url = new URL(request.url);
			真url.hostname = 最快.host;
			真url.pathname = 访问路径;
			真url.search = 访问参数;

			return fetch(new Request(真url, request));
		}

		// 执行主流程
		return await getFastestValidBackend(request, 后端域名);
	}
}

// 解析 HOST 环境变量中的域名列表
async function ADD(envadd) {
	let addtext = envadd.replace(/[ \t|"'\r\n]+/g, ',').replace(/,+/g, ',');
	if (addtext.startsWith(',')) addtext = addtext.slice(1);
	if (addtext.endsWith(',')) addtext = addtext.slice(0, -1);
	return addtext.split(',');
}

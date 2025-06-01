export default {
	// 主函数，处理传入的 HTTP 请求
	async fetch(request, env, ctx) {
		// 解析请求的 URL
		let url = new URL(request.url);
		const 访问路径 = url.pathname;
		const 访问参数 = url.search;

		// 默认后端域名列表
		let 后端域名 = [
			'www.baidu.com',
			'www.sogou.com',
			'www.so.com'
		];

		// 如果环境变量中有 HOST，则使用 ADD 函数获取新的后端域名列表
		if (env.HOST) 后端域名 = await ADD(env.HOST);

		// 获取测试路径，默认为 '/'
		let 测试路径 = env.PATH || '/';
		if (测试路径.charAt(0) !== '/') 测试路径 = '/' + 测试路径;

		let 响应代码 = env.CODE || '200';

		console.log(`后端数量: ${后端域名.length}\n后端域名: ${后端域名}\n测试路径: ${测试路径}\n响应代码: ${响应代码}`);

		// 带超时功能的 fetch
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

		// 并发尝试多个后端，使用第一个成功的
		async function getValidResponse(request, 后端域名列表) {
			const 测试请求列表 = 后端域名列表.map(host => {
				let 测试url = new URL(request.url);
				测试url.hostname = host;
				测试url.pathname = 测试路径.split('?')[0];
				测试url.search = 测试路径.includes('?') ? "?" + 测试路径.split('?')[1] : "";

				return fetchWithTimeout(new Request(测试url), { timeout: 1618 })
					.then(response => {
						if (response.status.toString() === 响应代码) {
							console.log(`使用后端: ${host}`);
							let 真url = new URL(request.url);
							真url.hostname = host;
							真url.pathname = 访问路径;
							真url.search = 访问参数;
							return fetch(new Request(真url, request));
						} else {
							throw new Error(`状态码不匹配: ${response.status}`);
						}
					});
			});

			try {
				return await Promise.any(测试请求列表);
			} catch (e) {
				console.log(`所有请求都失败: ${e}`);
				return new Response('所有后端都不可用！', {
					status: 404,
					headers: { 'content-type': 'text/plain; charset=utf-8' },
				});
			}
		}

		// 执行主流程
		return await getValidResponse(request, 后端域名);
	}
}

// 处理 HOST 环境变量，解析出多个域名
async function ADD(envadd) {
	var addtext = envadd.replace(/[	 |"'\r\n]+/g, ',').replace(/,+/g, ',');
	if (addtext.charAt(0) == ',') addtext = addtext.slice(1);
	if (addtext.charAt(addtext.length - 1) == ',') addtext = addtext.slice(0, addtext.length - 1);
	return addtext.split(',');
}

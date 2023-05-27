export default {
	/**
	 * @param {import("@cloudflare/workers-types").Request} request
	 * @param {{uuid: string}} env
	 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx
	 * @returns {Promise<Response>}
	 */
	async fetch(request, env, ctx) {
			const headers = {};
			for (const [name, value] of request.headers.entries()) {
				headers[name] = value;
			}

            const result = {
                "http-header": headers,
                "cf": request.cf
            }
			const headersJson = JSON.stringify(result);
			console.log(headersJson);
            return new Response(headersJson, { status: 200 });
	}
};

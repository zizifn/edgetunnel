export default {
	async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const address  = url.searchParams.get("address");
        if(!address){
            return new Response('not pass address', { status: 200 });
        }
        const resp = fetch(`http://${address}/cdn-cgi/trace`);
        return new Response((await resp).body, { status: 200 });
	}
};

export default {
  async fetch(request: Request, env: any) {
    return new Response(
      `request method111: ${request.method}, and env is ${JSON.stringify(
        env
      )} ${Date()}`
    );
  },
};

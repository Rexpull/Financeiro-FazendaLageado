
import "./css/index.css";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response('Hello World! 2');
	},
} satisfies ExportedHandler<Env>;

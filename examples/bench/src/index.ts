import {createKaitoHandler} from '@kaito-http/core';
import {KaitoServer} from '@kaito-http/uws';
import {getContext, router} from './context.ts';

const root = router().get('/', async () => 'Hey!');

const fetch = createKaitoHandler({
	router: root,
	getContext,

	onError: async ({error}) => ({
		status: 500,
		message: error.message,
	}),
});

const server = await KaitoServer.serve({
	fetch,
	port: 3000,
});

console.log('Server listening at', server.url);

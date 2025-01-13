import type {App} from './index.ts';
import {createKaitoHTTPClient} from '@kaito-http/client';
import * as readline from 'node:readline/promises';
import {stdin as input, stdout as output} from 'node:process';

const api = createKaitoHTTPClient<App>({
	base: 'http://localhost:3000',
});

async function main() {
	const rl = readline.createInterface({input, output});

	try {
		while (true) {
			const topic = await rl.question('What would you like a story about? ');
			const stream = await api.get('/v1/stories', {
				query: {
					topic,
				},
				sse: true,
			});
			for await (const chunk of stream) {
				// this does not necessarily flush afaik
				process.stdout.write(chunk.data);
			}
			// this will definitely flush stdout
			console.log('\n');
		}
	} finally {
		rl.close();
	}
}

main().catch(e => console.error('Error in ai client', e));
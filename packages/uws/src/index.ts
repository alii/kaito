import {AsyncLocalStorage} from 'node:async_hooks';
import uWS from 'uWebSockets.js';

export interface ServeOptions {
	port: number;
	host: string;
	fetch: (request: Request) => Promise<Response>;
}

export type ServeUserOptions = Omit<ServeOptions, 'host'> & Partial<Pick<ServeOptions, 'host'>>;

const BASE = 'http://kaito';
const SPACE = ' ';
const GET = 'get';
const HEAD = 'head';
const CONTENT_LENGTH = 'content-length';

interface StoreSocket {
	remoteAddress: string;
}

function createStoreSocket(res: uWS.HttpResponse): StoreSocket {
	return {
		get remoteAddress() {
			const value = Buffer.from(res.getRemoteAddressAsText()).toString('ascii');
			Object.defineProperty(this, 'remoteAddress', {value});
			return value;
		},
	};
}

const STORE = new AsyncLocalStorage<StoreSocket>();

export function getSocket() {
	const store = STORE.getStore();

	if (!store) {
		throw new Error(
			'You can only called getSocket() inside of getContext() or somewhere nested inside of a request handler',
		);
	}

	return store;
}

export class KaitoServer {
	private static getRequestBodyStream(res: uWS.HttpResponse) {
		return new ReadableStream<Uint8Array>({
			start(controller) {
				let buffer: Uint8Array | undefined;

				res.onData((ab, isLast) => {
					const chunk = new Uint8Array(ab.slice(0));

					if (buffer) {
						buffer = new Uint8Array([...buffer, ...chunk]);
					} else {
						buffer = chunk;
					}

					if (isLast) {
						if (buffer) {
							controller.enqueue(buffer);
						}
						controller.close();
					}
				});

				res.onAborted(() => {
					controller.error(new Error('Request aborted'));
				});
			},
		});
	}

	public static serve(options: ServeUserOptions) {
		const fullOptions: ServeOptions = {
			host: '0.0.0.0',
			...options,
		};

		const app = uWS.App().any('/*', async (res, req) => {
			let aborted = false;
			res.onAborted(() => {
				aborted = true;
			});

			const headers = new Headers();
			req.forEach((k, v) => headers.set(k, v));

			const method = req.getMethod();
			const url = BASE.concat(req.getUrl());

			const request = new Request(url, {
				headers,
				method,
				body: method === GET || method === HEAD ? null : this.getRequestBodyStream(res),
			});

			const response = await STORE.run(createStoreSocket(res), options.fetch, request);

			res.cork(() => {
				res.writeStatus(response.status.toString().concat(SPACE, response.statusText));

				for (const [header, value] of response.headers) {
					res.writeHeader(header, value);
				}

				if (!response.body) {
					res.end();
				}
			});

			if (!response.body) {
				return;
			}

			if (response.headers.has(CONTENT_LENGTH)) {
				const contentLength = parseInt(response.headers.get(CONTENT_LENGTH)!);

				if (contentLength < 65536) {
					res.end(await response.arrayBuffer());
					return;
				}
			}

			const writeNext = async (data: Uint8Array): Promise<void> => {
				let writeSucceeded: boolean | undefined;
				res.cork(() => {
					writeSucceeded = res.write(data);
				});

				if (!writeSucceeded) {
					return new Promise<void>(resolve => {
						let offset = 0;
						res.onWritable(availableSpace => {
							let ok: boolean | undefined;
							res.cork(() => {
								const chunk = data.subarray(offset, offset + availableSpace);
								ok = res.write(chunk);
							});

							if (ok) {
								offset += availableSpace;

								if (offset >= data.length) {
									resolve();
									return false;
								}
							}

							return true;
						});
					});
				}
			};

			try {
				const reader = response.body.getReader();

				while (!aborted) {
					const {done, value} = await reader.read();

					if (done) {
						break;
					}

					if (value) {
						await writeNext(value);
					}
				}
			} finally {
				if (!aborted) {
					res.cork(() => res.end());
				}
			}
		});

		const instance = new KaitoServer(app, fullOptions);

		return new Promise<KaitoServer>((resolve, reject) => {
			app.listen(fullOptions.host, fullOptions.port, ok => {
				if (ok) {
					resolve(instance);
				} else {
					reject(new Error('Failed to listen on port ' + fullOptions.port));
				}
			});
		});
	}

	private readonly app: ReturnType<typeof uWS.App>;
	private readonly options: ServeOptions;

	private constructor(app: ReturnType<typeof uWS.App>, options: ServeOptions) {
		this.app = app;
		this.options = options;
	}

	public close() {
		this.app.close();
	}

	public get address() {
		return `${this.options.host}:${this.options.port}`;
	}

	public get url() {
		return `http://${this.address}`;
	}
}

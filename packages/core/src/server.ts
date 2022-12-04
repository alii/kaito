import * as http from 'node:http';
import type {KaitoError} from './error';
import type {KaitoRequest} from './req';
import type {KaitoResponse} from './res';
import {type AnyRoute} from './route';
import type {Router} from './router';
import type {GetContext, KaitoMethod} from './util';

export type Before<BeforeAfterContext> = (
	req: http.IncomingMessage,
	res: http.ServerResponse
) => Promise<BeforeAfterContext>;

export type HandlerResult = {success: true; data: unknown} | {success: false; data: {status: number; message: string}};

export type After<BeforeAfterContext> = (ctx: BeforeAfterContext, result: HandlerResult) => Promise<void>;

export type ServerConfigWithBefore<BeforeAfterContext> =
	| {before: Before<BeforeAfterContext>; after?: After<BeforeAfterContext>}
	| {before?: undefined; after?: undefined};

export type Serializer = (handlerResult: HandlerResult) => string | Promise<string>;

export type DefaultSerializerJSONErroredAPIResponse = {success: false; data: null; message: string};
export type DefaultSerializerJSONSuccessfulAPIResponse<T> = {success: true; data: T; message: 'OK'};
export type DefaultSerializerJSONAPIResponse<T> =
	| DefaultSerializerJSONErroredAPIResponse
	| DefaultSerializerJSONSuccessfulAPIResponse<T>;
export type DefaultSerializerJSONAnyResponse = DefaultSerializerJSONAPIResponse<unknown>;

export const defaultJSONSerializer: Serializer = handlerResult =>
	JSON.stringify(
		handlerResult.success
			? {success: true, data: handlerResult.data, message: 'OK'}
			: ({success: false, data: null, message: handlerResult.data.message} satisfies DefaultSerializerJSONAnyResponse)
	);

export type ServerConfig<Context, BeforeAfterContext> = ServerConfigWithBefore<BeforeAfterContext> & {
	router: Router<Context, readonly AnyRoute[]>;
	getContext: GetContext<Context>;

	serializer?: Serializer;

	// Escape hatch for routes that will be loaded to fmw
	// but are not in the router.
	// Useful for things like OAuth callbacks or webhook endpoints.
	rawRoutes?: Partial<
		Record<
			KaitoMethod,
			Array<{
				path: string;
				handler: (request: http.IncomingMessage, response: http.ServerResponse) => unknown;
			}>
		>
	>;

	onError(arg: {
		error: Error;
		req: KaitoRequest;
		res: KaitoResponse;
	}): Promise<KaitoError | {status: number; message: string}>;
};

export function createFMWServer<Context, BeforeAfterContext = null>(config: ServerConfig<Context, BeforeAfterContext>) {
	const fmw = config.router.toFindMyWay(config);

	const rawRoutes = config.rawRoutes ?? {};

	for (const method in rawRoutes) {
		if (!Object.prototype.hasOwnProperty.call(rawRoutes, method)) {
			continue;
		}

		const routes = rawRoutes[method as keyof typeof rawRoutes];

		if (!routes || routes.length === 0) {
			continue;
		}

		for (const route of routes) {
			if (method === '*') {
				fmw.all(route.path, route.handler);
				continue;
			}

			fmw[method.toLowerCase() as Lowercase<Exclude<KaitoMethod, '*'>>](route.path, route.handler);
		}
	}

	const server = http.createServer(async (req, res) => {
		let before: BeforeAfterContext;

		if (config.before) {
			before = await config.before(req, res);
		} else {
			before = null as never;
		}

		// If the user has sent a response (e.g. replying to CORS), we don't want to do anything else.
		if (res.headersSent) {
			return;
		}

		const result = (await fmw.lookup(req, res)) as HandlerResult;

		if ('after' in config && config.after) {
			await config.after(before, result);
		}
	});

	return {server, fmw} as const;
}

export function createServer<Context, BeforeAfterContext = null>(config: ServerConfig<Context, BeforeAfterContext>) {
	return createFMWServer(config).server;
}

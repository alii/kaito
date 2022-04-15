import {IncomingMessage} from 'http';
import {TLSSocket} from 'tls';
import {getLastEntryInMultiHeaderValue, Method} from './util';

export class KaitoRequest {
	constructor(public readonly raw: IncomingMessage) {}

	get fullURL() {
		return `${this.protocol}://${this.hostname}${this.raw.url ?? ''}`;
	}

	get url() {
		return new URL(this.fullURL);
	}

	get method() {
		if (!this.raw.method) {
			throw new Error('Request method is not defined, somehow...');
		}

		return this.raw.method as Method;
	}

	get protocol(): 'http' | 'https' {
		if (this.raw.socket instanceof TLSSocket) {
			return this.raw.socket.encrypted ? 'https' : 'http';
		}

		return 'http';
	}

	get headers() {
		return this.raw.headers;
	}

	get hostname() {
		return this.raw.headers.host ?? getLastEntryInMultiHeaderValue(this.raw.headers[':authority'] ?? []);
	}
}
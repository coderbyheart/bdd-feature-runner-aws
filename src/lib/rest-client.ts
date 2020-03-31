import * as querystring from 'querystring'
import * as fetchPonyfill from 'fetch-ponyfill'

const { fetch } = fetchPonyfill()

const toQueryString = (obj: any): string => {
	if (!Object.keys(obj).length) {
		return ''
	}
	return '?' + querystring.stringify(obj)
}

export type Headers = {
	[index: string]: string
}

export class RestClient {
	headers: Headers = {
		Accept: 'application/json',
	}
	endpoint = ''

	response: {
		headers: Headers
		statusCode: number
		body: any
	} = {
		headers: {},
		statusCode: -1,
		body: '',
	}

	async request(
		method: string,
		path: string,
		queryString?: object,
		extraHeaders?: Headers,
		body?: any,
	): Promise<string> {
		const headers: Headers = {
			...this.headers,
			...extraHeaders,
		}
		const url = `${this.endpoint.replace(/\/+$/, '')}/${path.replace(
			/^\/+/,
			'',
		)}${toQueryString(queryString || {})}`
		const res = await fetch(url, {
			method,
			headers,
			body: body
				? typeof body !== 'string'
					? JSON.stringify(body)
					: body
				: undefined,
		})
		const contentType: string = res.headers.get('content-type') || '',
			mediaType: string = contentType.split(';')[0]
		if (!headers.Accept.includes(mediaType)) {
			console.debug(
				`[REST]`,
				JSON.stringify({ headers, body: await res.text() }),
			)
			throw new Error(
				`The content-type "${contentType}" of the response does not match accepted media-type ${headers.Accept}`,
			)
		}
		if (/^application\/([^ /]+\+)?json$/.test(mediaType) === false) {
			console.debug(
				`[REST]`,
				JSON.stringify({ headers, body: await res.text() }),
			)
			throw new Error(
				`The content-type "${contentType}" of the response is not JSON!`,
			)
		}
		const statusCode: number = res.status
		const contentLength: number = +(res.headers.get('content-length') || 0)
		const h: Headers = {}
		res.headers.forEach((v: string, k: string) => {
			h[k] = v
		})
		this.response = {
			statusCode,
			headers: h,
			body: contentLength ? await res.json() : undefined,
		}
		return url
	}
}

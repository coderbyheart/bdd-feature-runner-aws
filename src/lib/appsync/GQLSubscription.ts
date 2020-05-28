import { FeatureRunner } from '../runner'
import { expect } from 'chai'
import * as Websocket from 'ws'
import { Client, Message } from 'paho-mqtt'

// @ts-ignore
global.WebSocket = Websocket // required for Paho MQTT

export class GQLSubscription {
	public readonly connection: Promise<Client>
	public messages: any[] = []
	private readonly client: Client
	private readonly subscribers: {
		id: string
		matches: (msg: { [key: string]: string }) => boolean
		onMatch: ((msg: any) => void)[]
	}[] = []
	private readonly subscriberMessages: { [key: string]: any[] } = {}

	constructor(
		selection: string,
		url: string,
		clientId: string,
		topics: string[],
		runner: FeatureRunner<any>,
	) {
		this.client = new Client(url, clientId)
		this.client.onMessageArrived = (msg: Message) => {
			const {
				data: { [selection]: result },
			} = JSON.parse(msg.payloadString)
			this.messages.push(result)
			void runner.progress('<GQL@', msg.payloadString)
			this.notifySubcribers(result)
		}

		this.connection = new Promise((resolve, reject) => {
			this.client.connect({
				useSSL: false,
				mqttVersion: 3,
				onSuccess: async () => {
					await Promise.all(
						topics.map(
							(topic) =>
								new Promise((resolve1, reject1) => {
									this.client.subscribe(topic, {
										onSuccess: resolve1,
										onFailure: reject1,
									})
								}),
						),
					)
					resolve(this.client)
				},
				onFailure: reject,
			})
		})
	}

	notifySubcribers = (result: { [key: string]: string }): void => {
		this.subscribers.forEach(({ id, matches, onMatch }) => {
			if (matches(result)) {
				if (this.subscriberMessages[id] !== undefined) {
					this.subscriberMessages[id] = []
				}
				this.subscriberMessages[id].push(result)
				onMatch.forEach((fn) => fn(result))
			}
		})
	}

	addListener = (
		listenerId: string,
		matcher: { [key: string]: string },
	): void => {
		this.subscribers.push({
			id: listenerId,
			matches: (message: any): boolean => {
				try {
					expect(message).to.containSubset(matcher)
					return true
				} catch (error) {
					return false
				}
			},
			onMatch: [],
		})
		// Notify about existing messages
		this.messages.forEach((message) => this.notifySubcribers(message))
	}

	disconnect = (): void => {
		this.client.disconnect()
	}

	/**
	 * Returns a message for the given subscription id within a certain time
	 */
	listenerMessage = async (
		listenerId: string,
		timeout = 5000,
	): Promise<any> => {
		if (
			Array.isArray(this.subscriberMessages[listenerId]) &&
			this.subscriberMessages[listenerId].length > 0
		) {
			return this.subscriberMessages[listenerId][
				this.subscriberMessages[listenerId].length - 1
			]
		}
		let messageListenerId: number

		return new Promise<any>((resolve, reject) => {
			const sub = this.subscribers.find(({ id }) => id === listenerId)
			if (!sub) {
				throw new Error(`Subscriber for "${listenerId}" not found!`)
			}
			const timeoutId = setTimeout(() => {
				sub.onMatch.splice(messageListenerId, 1)
				reject()
			}, timeout)

			// Register listener for arriving messages
			messageListenerId = sub.onMatch.push((msg: any) => {
				clearTimeout(timeoutId)
				resolve(msg)
			})
		})
	}
}

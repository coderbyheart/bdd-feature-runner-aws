import { SQS } from 'aws-sdk';
import { FeatureRunner } from './runner';

const sqs = new SQS();
type WebhookRequest = {
  headers: { [key: string]: string };
  body: object;
};

/**
 * Manages the waiting for webhook requests.
 */
export class WebhookReceiver {
  private queueUrl: string;
  latestWebhookRequest?: WebhookRequest;

  constructor(queueUrl: string) {
    this.queueUrl = queueUrl;
  }

  /**
   * When multiple alerts are configured, messages may result in the webhook
   * receiver receiving multiple requests from different alerts.
   *
   * This receiver will wait until a request arrives for a specific message group
   * id (which is the path after the API URL: {webhookReceiver}/message-group).
   *
   * Requests from other message groups will be discarded.
   */
  async waitForWebhookRequest(
    MessageGroupId: string,
    runner: FeatureRunner<any>,
    wait = 30,
  ): Promise<WebhookRequest> {
    const waitNow = Math.min(wait, 20);
    if (waitNow <= 0) throw new Error('No webhook request received (Timeout)!');
    const { Messages } = await sqs
      .receiveMessage({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: waitNow,
        MessageAttributeNames: ['All'],
        AttributeNames: ['MessageGroupId'],
      })
      .promise();
    if (Messages === undefined || !Messages.length) {
      // Within our time limit no matching webhook request was received
      runner.progress('Webhook', 'Wait timeout.');
      return this.waitForWebhookRequest(
        MessageGroupId,
        runner,
        Math.round(wait - waitNow),
      );
    }
    const {
      Body,
      MessageAttributes,
      ReceiptHandle,
      Attributes,
    } = Messages[0] as SQS.Types.Message;
    await sqs
      .deleteMessage({
        QueueUrl: this.queueUrl,
        ReceiptHandle: ReceiptHandle as string,
      })
      .promise();
    const attrs = MessageAttributes as SQS.Types.MessageBodyAttributeMap;
    const {
      MessageGroupId: RcvdMessageGroupId,
    } = Attributes as SQS.Types.MessageSystemAttributeMap;
    this.latestWebhookRequest = {
      headers: Object.keys(attrs).reduce(
        (hdrs: { [key: string]: string }, key) => {
          hdrs[key] = attrs[key].StringValue as string;
          return hdrs;
        },
        {},
      ),
      body: JSON.parse(Body as string),
    };
    runner.progress(
      `Webhook < ${RcvdMessageGroupId}`,
      JSON.stringify(this.latestWebhookRequest.body),
    );
    if (RcvdMessageGroupId !== MessageGroupId) {
      // Ignore this one, we are waiting for the next
      return this.waitForWebhookRequest(
        MessageGroupId,
        runner,
        Math.round(wait - waitNow),
      );
    }
    return this.latestWebhookRequest;
  }

  /**
   * Deletes all messages in a Queue instead of using purge (which can only be used every 60 seconds)
   */
  async clearQueue() {
    const { Messages } = await sqs
      .receiveMessage({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
      })
      .promise();
    if (Messages !== undefined) {
      await Promise.all(
        Messages.map(({ ReceiptHandle }) =>
          sqs
            .deleteMessage({
              QueueUrl: this.queueUrl,
              ReceiptHandle: ReceiptHandle as string,
            })
            .promise(),
        ),
      );
      await this.clearQueue();
      this.latestWebhookRequest = undefined;
    }
  }
}

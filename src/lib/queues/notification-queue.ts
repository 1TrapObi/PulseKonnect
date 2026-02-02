import { Queue } from "bullmq";

import { getRedisConnection } from "@/lib/queues/redis";

export type NotificationJobType = "send-email";

export type SendEmailJob = {
  jobType: "send-email";
  notificationId: string;
};

export type NotificationJobPayload = SendEmailJob;

let notificationQueue: Queue<NotificationJobPayload> | null = null;

function getNotificationQueue() {
  if (!process.env.REDIS_URL) return null;
  if (notificationQueue) return notificationQueue;

  notificationQueue = new Queue<NotificationJobPayload>("notification-queue", {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 500,
      removeOnFail: 500,
    },
  });

  return notificationQueue;
}

export async function enqueueSendEmail(notificationId: string) {
  const queue = getNotificationQueue();
  if (!queue) return;

  try {
    return await queue.add("send-email", {
      jobType: "send-email",
      notificationId,
    });
  } catch {
    return;
  }
}

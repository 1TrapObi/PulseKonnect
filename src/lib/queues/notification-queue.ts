import { Queue } from "bullmq";

import { getRedisConnection } from "@/lib/queues/redis";

export type NotificationJobType = "send-email";

export type SendEmailJob = {
  jobType: "send-email";
  notificationId: string;
};

export type NotificationJobPayload = SendEmailJob;

export const notificationQueue = new Queue<NotificationJobPayload>("notification-queue", {
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

export async function enqueueSendEmail(notificationId: string) {
  return notificationQueue.add("send-email", {
    jobType: "send-email",
    notificationId,
  });
}

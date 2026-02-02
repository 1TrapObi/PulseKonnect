import IORedis from "ioredis";

export function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }

  return new IORedis(url, {
    maxRetriesPerRequest: null,
  });
}

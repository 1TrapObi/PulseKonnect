export async function testPostConnection(apiKey: string): Promise<{ connected: boolean; error?: string }> {
  const key = (apiKey ?? "").trim();
  if (!key) return { connected: false, error: "Missing API key" };

  const verifyUrl = process.env.POST_VERIFY_URL;
  if (!verifyUrl) {
    return { connected: true };
  }

  try {
    const res = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    if (!res.ok) {
      return { connected: false, error: `Post verification failed (${res.status})` };
    }

    return { connected: true };
  } catch (e: any) {
    return { connected: false, error: e?.message ?? "Post verification failed" };
  }
}

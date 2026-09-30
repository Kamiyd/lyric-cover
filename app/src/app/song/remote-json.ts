export type FetchLike = (
  input: string,
  init?: Readonly<{ signal?: AbortSignal }>,
) => Promise<Pick<Response, "json" | "ok" | "status">>;

export class RemoteUnavailableError extends Error {
  constructor(readonly status: number | null) {
    super(status === null ? "Network request failed." : `Request failed with HTTP ${status}.`);
    this.name = "RemoteUnavailableError";
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

/**
 * GET JSON. 404 resolves to null; 429/5xx are retried with a short back-off because LRCLIB
 * occasionally answers 503 under load.
 */
export async function fetchJson(
  url: string,
  options: Readonly<{ fetch?: FetchLike; retries?: number; retryDelayMs?: number; signal?: AbortSignal }> = {},
): Promise<unknown> {
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const attempts = Math.max(1, options.retries ?? 3);
  const delay = options.retryDelayMs ?? 700;
  let lastStatus: number | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    options.signal?.throwIfAborted();
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await doFetch(url, { signal: options.signal });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      lastStatus = null;
      if (attempt < attempts - 1) await wait(delay * (attempt + 1));
      continue;
    }
    if (response.ok) return response.json();
    if (response.status === 404) return null;
    lastStatus = response.status;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable) break;
    if (attempt < attempts - 1) await wait(delay * (attempt + 1));
  }
  throw new RemoteUnavailableError(lastStatus);
}

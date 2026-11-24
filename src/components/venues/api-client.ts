export class VenueRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function venueRequest<T = object>(
  url: string,
  method = "GET",
  payload?: unknown,
  extraHeaders?: HeadersInit,
): Promise<T> {
  const headers = new Headers(extraHeaders);
  const body =
    payload instanceof FormData
      ? payload
      : payload === undefined
        ? undefined
        : JSON.stringify(payload);
  if (typeof body === "string") headers.set("Content-Type", "application/json");
  const response = await fetch(url, { method, headers, body });
  const result = await response.json();
  if (!response.ok || !result.success) {
    const details = (result.error?.details as { message: string }[] | undefined)
      ?.map((issue) => issue.message)
      .join(" ");
    throw new VenueRequestError(
      response.status,
      result.error?.code ?? "REQUEST_FAILED",
      details || result.message || "PitchMate could not complete your request.",
    );
  }
  return result.data;
}

export async function venueRequest<T = object>(
  url: string,
  method = "GET",
  payload?: unknown,
): Promise<T> {
  const request =
    payload instanceof FormData
      ? { body: payload }
      : payload === undefined
        ? {}
        : {
            body: JSON.stringify(payload),
            headers: { "Content-Type": "application/json" },
          };
  const response = await fetch(url, { method, ...request });
  const result = await response.json();
  if (!response.ok || !result.success) {
    const details = (result.error?.details as { message: string }[] | undefined)
      ?.map((issue) => issue.message)
      .join(" ");
    throw new Error(
      details || result.message || "PitchMate could not complete your request.",
    );
  }
  return result.data;
}

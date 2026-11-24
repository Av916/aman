import { recordHttp } from "./metrics";
import { log, requestScope, routeLabel } from "./log";
import { z } from "zod";
import { getEnv } from "./env";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== getEnv().APP_URL) {
    throw new AppError(
      403,
      "ORIGIN_REJECTED",
      "This request must come from PitchMate.",
    );
  }
}

export async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  assertSameOrigin(request);
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new AppError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Send a JSON request body.",
    );
  }

  const limit = 8192;
  if (Number(request.headers.get("content-length")) > limit) {
    throw new AppError(413, "BODY_TOO_LARGE", "The request body is too large.");
  }
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError(
          413,
          "BODY_TOO_LARGE",
          "The request body is too large.",
        );
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new AppError(
      400,
      "INVALID_JSON",
      "The request body must contain valid JSON.",
    );
  }
  return schema.parse(value);
}

const headers = { "Cache-Control": "no-store" };

export function success(message: string, data: object = {}, status = 200) {
  return Response.json({ success: true, message, data }, { status, headers });
}

export function endpoint<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  async function handle(request: Request, ...args: Args): Promise<Response> {
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const details = error.issues.map(({ path, message }) => ({
          field: path.join("."),
          message,
        }));
        return Response.json(
          {
            success: false,
            message: "Check the information you entered.",
            error: { code: "VALIDATION_ERROR", details },
          },
          { status: 422, headers },
        );
      }
      if (error instanceof AppError) {
        log(error.status >= 500 ? "error" : "debug", "http.operation_error", {
          code: error.code,
          status: error.status,
        });
        return Response.json(
          {
            success: false,
            message: error.message,
            error: { code: error.code, details: [] },
          },
          {
            status: error.status,
            headers:
              error.status === 429
                ? { ...headers, "Retry-After": String(error.retryAfter ?? 900) }
                : headers,
          },
        );
      }
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        return Response.json(
          {
            success: false,
            message: "A record with these details already exists.",
            error: { code: "DUPLICATE_RECORD", details: [] },
          },
          { status: 409, headers },
        );
      }
      log("error", "http.unhandled", {
        code: "INTERNAL_ERROR",
        method: request.method,
      });
      return Response.json(
        {
          success: false,
          message: "Something went wrong. Please try again.",
          error: { code: "INTERNAL_ERROR", details: [] },
        },
        { status: 500, headers },
      );
    }
  }
  return (request: Request, ...args: Args) =>
    requestScope(async (requestId) => {
      const start = performance.now();
      const response = await handle(request, ...args);
      const headers = new Headers(response.headers);
      headers.set("X-Request-Id", requestId);
      const method = request.method;
      const route = routeLabel(new URL(request.url).pathname);
      const elapsed = Math.round(performance.now() - start);
      recordHttp(route, method, response.status, elapsed);
      log(
        response.status >= 500
          ? "error"
          : response.status >= 400
            ? "warn"
            : "info",
        "http.request",
        { route, method, status: response.status, durationMs: elapsed },
      );
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    });
}

import { HttpResponse, type HttpResponseResolver, type JsonBodyType } from "msw";
import type { Page } from "../api/types";

const MAX_PAGE = 10_000;

export class MockApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "MockApiError";
    this.status = status;
    this.code = code;
  }
}

export const unauthorized = (message = "Log in to continue") =>
  new MockApiError(401, "unauthorized", message);
export const invalid = (message: string) => new MockApiError(422, "validation_error", message);
export const notFound = (message: string) => new MockApiError(404, "not_found", message);
export const conflict = (message: string) => new MockApiError(409, "conflict", message);

type RouteInfo = Parameters<HttpResponseResolver>[0];

// a returned value becomes json, a thrown MockApiError becomes the contract error
export function route(resolver: (info: RouteInfo) => JsonBodyType | Response | Promise<JsonBodyType | Response>): HttpResponseResolver {
  return async (info) => {
    try {
      const result = await resolver(info);
      return result instanceof Response ? result : HttpResponse.json(result);
    } catch (error) {
      if (!(error instanceof MockApiError)) throw error;
      return HttpResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
  };
}

export const created = (body: JsonBodyType) => HttpResponse.json(body, { status: 201 });
export const noContent = () => new HttpResponse(null, { status: 204 });

const capitalize = (field: string) => field.charAt(0).toUpperCase() + field.slice(1);

export function optionalText(
  data: Record<string, unknown>,
  field: string,
  maxLength: number,
): string | null {
  const value = data[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw invalid(`${capitalize(field)} must be text`);
  const text = value.trim();
  if (text.length > maxLength) {
    throw invalid(`${capitalize(field)} must be ${maxLength} characters or fewer`);
  }
  return text || null;
}

export function requiredText(
  data: Record<string, unknown>,
  field: string,
  maxLength: number,
): string {
  const text = optionalText(data, field, maxLength);
  if (text === null) throw invalid(`${capitalize(field)} is required`);
  return text;
}

export function pageArg(url: URL): number {
  const raw = url.searchParams.get("page");
  const page = raw !== null && /^[+-]?\d+$/.test(raw) ? Number(raw) : 1;
  if (page < 1 || page > MAX_PAGE) throw invalid(`Page must be between 1 and ${MAX_PAGE}`);
  return page;
}

export const pagePayload = <T>(items: T[], page: number, total: number, perPage: number): Page<T> => ({
  items,
  page,
  pages: Math.ceil(total / perPage),
  total,
});

export const paginate = <T>(all: T[], page: number, perPage: number): Page<T> =>
  pagePayload(all.slice((page - 1) * perPage, page * perPage), page, all.length, perPage);

export const isUnhandledApiRequest = (request: Request) =>
  new URL(request.url).pathname.startsWith("/api/");

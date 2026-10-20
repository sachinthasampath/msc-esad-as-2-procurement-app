import { handle } from "../../../../src/server/handle";

type Context = { params: Promise<{ path?: string[] }> };

async function dispatch(request: Request, context: Context) {
  const { path = [] } = await context.params;
  return handle(request, path);
}

export const GET = dispatch;
export const POST = dispatch;
export const PATCH = dispatch;
export const PUT = dispatch;
export const OPTIONS = dispatch;

import { NextRequest, NextResponse } from 'next/server';

/**
 * BFF proxy only - no business logic. Forwards browser requests to the real
 * backend (apps/api) and attaches whatever the current "session" is.
 *
 * TODO(auth): today that's a dev learner id from an env var, because auth is
 * deliberately stubbed. Once real sessions exist, this is the one place
 * that reads the session cookie and turns it into whatever the API expects
 * - client code and domain hooks never change.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const DEV_LEARNER_ID = process.env.DEV_LEARNER_ID ?? 'dev-learner-1';

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const targetUrl = `${API_URL}/api/${path.join('/')}${req.nextUrl.search}`;
  const isBodilessMethod = ['GET', 'HEAD'].includes(req.method);

  const init: RequestInit = {
    method: req.method,
    headers: {
      'content-type': req.headers.get('content-type') ?? 'application/json',
      'x-dev-learner-id': DEV_LEARNER_ID,
    },
    ...(isBodilessMethod ? {} : { body: await req.text() }),
  };

  const res = await fetch(targetUrl, init);
  const body = await res.text();

  return new NextResponse(body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '';

// Server-side proxy — reads the backend JWT directly from the encrypted cookie
// using getToken(). The token never leaves the server, so client JS cannot read it.
async function handler(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const accessToken = token?.accessToken as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { path } = await context.params;
  const backendPath = path.join('/');
  const url = new URL(`${API_URL}/${backendPath}`);

  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const contentType = req.headers.get('content-type') || 'application/json';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': contentType,
  };

  const init: RequestInit = { method: req.method, headers };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const backendRes = await fetch(url.toString(), init);
    const body = await backendRes.text();
    return new NextResponse(body, {
      status: backendRes.status,
      headers: { 'Content-Type': backendRes.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const PUT = handler;

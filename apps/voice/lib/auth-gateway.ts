import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { qOne } from './db';

export interface AuthOk {
  ok: true;
  scopes: string[];
  label?: string;
  via: 'env' | 'token';
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  // 32 bytes -> 64-char hex string.
  return randomBytes(32).toString('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a `Authorization: Bearer <token>` header. Returns either an
 * AuthOk object or a NextResponse 401 you should `return` directly.
 */
export async function verifyGatewayAuth(
  req: Request
): Promise<AuthOk | NextResponse> {
  const header = req.headers.get('authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return NextResponse.json(
      { ok: false, error: 'Missing Authorization: Bearer header.' },
      { status: 401 }
    );
  }
  const token = m[1].trim();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Empty bearer token.' },
      { status: 401 }
    );
  }

  // Backdoor for the bootstrap value — apps can call across without an issued
  // service token until one is generated via /settings/service-tokens.
  const internal = process.env.VOICE_GATEWAY_INTERNAL_TOKEN;
  if (internal && safeEqual(token, internal)) {
    return {
      ok: true,
      scopes: ['llm:run', 'llm:structured'],
      label: 'internal-bootstrap',
      via: 'env',
    };
  }

  const hash = hashToken(token);
  const row = await qOne<{ id: string; label: string; scopes: string[] }>(
    `select id, label, scopes
       from voice.service_tokens
      where token_hash = $1 and revoked_at is null
      limit 1`,
    [hash]
  );
  if (!row) {
    return NextResponse.json(
      { ok: false, error: 'Invalid or revoked token.' },
      { status: 401 }
    );
  }
  return { ok: true, scopes: row.scopes, label: row.label, via: 'token' };
}

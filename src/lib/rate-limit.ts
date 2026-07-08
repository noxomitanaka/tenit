/**
 * 単純な in-memory スライディングウィンドウ レートリミッタ。
 * self-hosted 単一ノード運用を前提とする（tenit の標準構成）。
 * 複数レプリカ／サーバーレスでは共有ストア（Redis 等）が必要になるため、
 * その場合は差し替える。公開エンドポイントの乱用（総当たり・スパム）抑止が用途。
 */
const buckets = new Map<string, number[]>();

/**
 * key に対して windowMs 内 limit 回まで許可する。
 * 許可なら true、超過なら false を返す。
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

/** テスト用: レートリミッタの状態を全消去する。 */
export function __resetRateLimit(): void {
  buckets.clear();
}

/** リクエストヘッダからクライアント IP を推定する（プロキシ背後を想定）。 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

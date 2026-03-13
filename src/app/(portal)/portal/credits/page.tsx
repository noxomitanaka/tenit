'use client';
import { useState, useEffect } from 'react';

interface Credit {
  id: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  isActive: boolean;
  isExpired: boolean;
  isUsed: boolean;
}

export default function PortalCreditsPage() {
  const [credits, setCredits] = useState<Credit[] | null>(null);

  useEffect(() => {
    fetch('/api/portal/credits')
      .then(r => r.json())
      .then(setCredits);
  }, []);

  if (!credits) return <div className="p-4 text-gray-400 text-center">読み込み中...</div>;

  const active = credits.filter(c => c.isActive);
  const inactive = credits.filter(c => !c.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">振替クレジット</h1>
        <span className="bg-emerald-100 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full">
          有効 {active.length}件
        </span>
      </div>

      {credits.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">
          振替クレジットはありません
        </div>
      )}

      {active.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-emerald-50">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">有効なクレジット</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {active.map(c => (
              <li key={c.id} className="px-5 py-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-800">振替チケット</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    取得: {new Date(c.createdAt).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    有効
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    期限: {new Date(c.expiresAt).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">使用済み・期限切れ</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {inactive.map(c => (
              <li key={c.id} className="px-5 py-4 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-500">振替チケット</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    取得: {new Date(c.createdAt).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <div className="text-right">
                  {c.isUsed ? (
                    <span className="inline-block bg-gray-100 text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full">
                      使用済み
                    </span>
                  ) : (
                    <span className="inline-block bg-red-50 text-red-500 text-xs font-medium px-2.5 py-1 rounded-full">
                      期限切れ
                    </span>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    期限: {new Date(c.expiresAt).toLocaleDateString('ja-JP')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
        振替クレジットは欠席時に発行されます。有効期限内に振替レッスンの予約でご利用ください。
      </div>
    </div>
  );
}

/**
 * Unit tests: DBスキーマ構造チェック
 * テーブル定義が期待通りのカラムを持つか
 */
import { describe, it, expect } from 'vitest';
import { users, members, groups, courts, lessons, lessonSlots, reservations, substitutionCredits, clubSettings } from '@/db/schema';

describe('DB Schema', () => {
  describe('users テーブル', () => {
    it('必須カラムが定義されている', () => {
      const cols = Object.keys(users);
      expect(cols).toContain('id');
      expect(cols).toContain('email');
      expect(cols).toContain('role');
      expect(cols).toContain('hashedPassword');
    });
  });

  describe('members テーブル', () => {
    it('必須カラムが定義されている', () => {
      const cols = Object.keys(members);
      expect(cols).toContain('id');
      expect(cols).toContain('name');
      expect(cols).toContain('status');
      expect(cols).toContain('parentMemberId'); // 家族アカウント
    });
  });

  describe('reservations テーブル', () => {
    it('振替フラグが存在する', () => {
      const cols = Object.keys(reservations);
      expect(cols).toContain('isSubstitution');
      expect(cols).toContain('originalReservationId');
    });
  });

  describe('substitutionCredits テーブル', () => {
    it('振替クレジットの有効期限・使用状態が存在する', () => {
      const cols = Object.keys(substitutionCredits);
      expect(cols).toContain('expiresAt');
      expect(cols).toContain('usedAt');
      expect(cols).toContain('memberId');
    });
  });

  describe('courts テーブル', () => {
    it('コート属性が定義されている', () => {
      const cols = Object.keys(courts);
      expect(cols).toContain('name');
      expect(cols).toContain('surface');
      expect(cols).toContain('isIndoor');
      expect(cols).toContain('isActive');
    });
  });
});

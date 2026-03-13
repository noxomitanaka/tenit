import { sql } from 'drizzle-orm';
import {
  text,
  integer,
  sqliteTable,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

// ─── NextAuth required tables ───────────────────────────────────────────────

export const users = sqliteTable('user', {
  id: text('id').notNull().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image: text('image'),
  // Tenit-specific fields
  role: text('role', { enum: ['admin', 'coach', 'member'] }).notNull().default('member'),
  hashedPassword: text('hashed_password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

export const accounts = sqliteTable(
  'account',
  {
    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: integer('expires', { mode: 'timestamp_ms' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─── Club settings ────────────────────────────────────────────────────────────

export const clubSettings = sqliteTable('club_settings', {
  id: integer('id').notNull().primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  lineChannelAccessToken: text('line_channel_access_token'),
  lineChannelSecret: text('line_channel_secret'),
  substitutionDeadlineDays: integer('substitution_deadline_days').notNull().default(31),
  defaultMonthlyFee: integer('default_monthly_fee').notNull().default(0),
  stripePublishableKey: text('stripe_publishable_key'),
  stripeSecretKey: text('stripe_secret_key'),
  stripeWebhookSecret: text('stripe_webhook_secret'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

// ─── Member management ────────────────────────────────────────────────────────

export const members = sqliteTable('member', {
  id: text('id').notNull().primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  nameKana: text('name_kana'),
  email: text('email'),
  phone: text('phone'),
  level: text('level', { enum: ['beginner', 'intermediate', 'advanced'] }).default('beginner'),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  joinedAt: integer('joined_at', { mode: 'timestamp_ms' }),
  leftAt: integer('left_at', { mode: 'timestamp_ms' }),
  parentMemberId: text('parent_member_id'), // 家族アカウント: 保護者 → ジュニア
  lineUserId: text('line_user_id'),          // LINE通知用
  stripeCustomerId: text('stripe_customer_id'), // Stripe顧客ID（自動作成）
  monthlyFee: integer('monthly_fee'),           // 個別月謝（nullの場合クラブデフォルト適用）
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

export const groups = sqliteTable('group', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  level: text('level', { enum: ['beginner', 'intermediate', 'advanced', 'junior', 'adult', 'other'] }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

export const memberGroups = sqliteTable(
  'member_group',
  {
    memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    groupId: text('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  },
  (mg) => ({
    compoundKey: primaryKey({ columns: [mg.memberId, mg.groupId] }),
  })
);

// ─── Court & schedule ─────────────────────────────────────────────────────────

export const courts = sqliteTable('court', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  surface: text('surface', { enum: ['hard', 'clay', 'grass', 'carpet', 'other'] }),
  isIndoor: integer('is_indoor', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const lessons = sqliteTable('lesson', {
  id: text('id').notNull().primaryKey(),
  title: text('title').notNull(),
  coachId: text('coach_id').references(() => users.id, { onDelete: 'set null' }),
  courtId: text('court_id').references(() => courts.id, { onDelete: 'set null' }),
  groupId: text('group_id').references(() => groups.id, { onDelete: 'set null' }),
  type: text('type', { enum: ['lesson', 'free_court', 'event'] }).notNull().default('lesson'),
  // 繰り返し設定
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
  recurringDayOfWeek: integer('recurring_day_of_week'), // 0=日曜
  startTime: text('start_time').notNull(), // HH:MM
  endTime: text('end_time').notNull(),     // HH:MM
  maxParticipants: integer('max_participants'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

// 個別の枠（定期レッスンの展開済みインスタンス or 単発）
export const lessonSlots = sqliteTable('lesson_slot', {
  id: text('id').notNull().primaryKey(),
  lessonId: text('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // YYYY-MM-DD
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  status: text('status', { enum: ['open', 'cancelled', 'completed'] }).notNull().default('open'),
  cancelReason: text('cancel_reason'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

// ─── Reservations ─────────────────────────────────────────────────────────────

export const reservations = sqliteTable('reservation', {
  id: text('id').notNull().primaryKey(),
  lessonSlotId: text('lesson_slot_id').notNull().references(() => lessonSlots.id, { onDelete: 'cascade' }),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['confirmed', 'cancelled', 'absent'] }).notNull().default('confirmed'),
  isSubstitution: integer('is_substitution', { mode: 'boolean' }).notNull().default(false),
  originalReservationId: text('original_reservation_id'), // 振替元の予約ID
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

// ─── Substitution credits ──────────────────────────────────────────────────────

export const substitutionCredits = sqliteTable('substitution_credit', {
  id: text('id').notNull().primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  sourceReservationId: text('source_reservation_id').references(() => reservations.id),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
  usedReservationId: text('used_reservation_id').references(() => reservations.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

// ─── Tournaments ──────────────────────────────────────────────────────────────

export const tournaments = sqliteTable('tournament', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['swiss', 'elimination', 'round_robin'] }).notNull().default('swiss'),
  status: text('status', { enum: ['draft', 'active', 'completed'] }).notNull().default('draft'),
  date: text('date'),                         // YYYY-MM-DD
  rounds: integer('rounds').notNull().default(3),
  maxParticipants: integer('max_participants'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

export const tournamentEntries = sqliteTable(
  'tournament_entry',
  {
    id: text('id').notNull().primaryKey(),
    tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    seed: integer('seed'),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    draws: integer('draws').notNull().default(0),
    points: integer('points').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s', 'now') * 1000)`),
  }
);

export const tournamentMatches = sqliteTable('tournament_match', {
  id: text('id').notNull().primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  round: integer('round').notNull(),
  player1Id: text('player1_id').references(() => members.id),
  player2Id: text('player2_id').references(() => members.id), // null = BYE
  score1: text('score1'),   // "6-4" など文字列で柔軟に
  score2: text('score2'),
  winnerId: text('winner_id').references(() => members.id),
  courtId: text('court_id').references(() => courts.id),
  scheduledTime: text('scheduled_time'),  // HH:MM
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

// ─── Monthly fees ─────────────────────────────────────────────────────────────

export const monthlyFees = sqliteTable('monthly_fee', {
  id: text('id').notNull().primaryKey(),
  memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  month: text('month').notNull(),         // YYYY-MM
  amount: integer('amount').notNull(),    // 円
  status: text('status', { enum: ['pending', 'paid', 'overdue', 'waived'] }).notNull().default('pending'),
  paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

// ─── Attendance ───────────────────────────────────────────────────────────────

export const attendances = sqliteTable(
  'attendance',
  {
    id: text('id').notNull().primaryKey(),
    lessonSlotId: text('lesson_slot_id').notNull().references(() => lessonSlots.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    method: text('method', { enum: ['qr', 'manual'] }).notNull().default('manual'),
    markedAt: integer('marked_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s', 'now') * 1000)`),
    markedBy: text('marked_by').references(() => users.id, { onDelete: 'set null' }),
  }
);

// ─── Broadcast messages ───────────────────────────────────────────────────────

export const broadcastMessages = sqliteTable('broadcast_message', {
  id: text('id').notNull().primaryKey(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  channel: text('channel', { enum: ['email', 'line', 'both'] }).notNull().default('email'),
  targetType: text('target_type', { enum: ['all', 'group', 'level'] }).notNull().default('all'),
  targetId: text('target_id'),   // groupId or level value
  sentCount: integer('sent_count').notNull().default(0),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s', 'now') * 1000)`),
});

// Type exports
export type User = typeof users.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Court = typeof courts.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type LessonSlot = typeof lessonSlots.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type SubstitutionCredit = typeof substitutionCredits.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type TournamentEntry = typeof tournamentEntries.$inferSelect;
export type TournamentMatch = typeof tournamentMatches.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
export type BroadcastMessage = typeof broadcastMessages.$inferSelect;
export type MonthlyFee = typeof monthlyFees.$inferSelect;

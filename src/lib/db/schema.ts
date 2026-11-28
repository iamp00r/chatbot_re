/**
 * Drizzle 스키마 — 쿼리 타입용.
 *
 * DB의 기준(source of truth)은 `supabase/migrations/*.sql`이다. 제약·인덱스·트리거·RLS는 SQL에만 있다.
 * 이 파일은 컬럼·기본키·외래키만 옮긴다. SQL을 바꾸면 이 파일도 고치고,
 * `tests/db/schema-sync.test.ts`가 실제 DB 컬럼과 어긋나지 않는지 확인한다.
 */
import {
  bigint,
  bigserial,
  boolean,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).defaultNow();
const seq = (name: string) => bigint(name, { mode: "number" });
const seqArray = (name: string) => bigint(name, { mode: "number" }).array().notNull().default([]);

// Supabase auth.users (참조용, 이 프로젝트에서 만들지 않음)
const auth = pgSchema("auth");
export const authUsers = auth.table("users", {
  id: uuid("id").primaryKey(),
});

// ───────────── 사용자 ─────────────
export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  nickname: text("nickname").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: createdAt(),
});

// ───────────── 캐릭터 ─────────────
export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tagline: text("tagline"),
  avatarUrl: text("avatar_url"),
  appearance: text("appearance"),
  personality: text("personality"),
  speechStyle: text("speech_style"),
  background: text("background"),
  rules: text("rules"),
  exampleDialogues: text("example_dialogues"),
  pronoun: text("pronoun"),
  visibility: text("visibility", { enum: ["private", "unlisted", "public"] })
    .notNull()
    .default("private"),
  reviewStatus: text("review_status", { enum: ["none", "pending", "approved", "rejected"] })
    .notNull()
    .default("none"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ───────────── 작품 ─────────────
export const stories = pgTable("stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  worldSetting: text("world_setting"),
  intro: text("intro").notNull(),
  introSpeakerId: uuid("intro_speaker_id").references(() => characters.id, {
    onDelete: "set null",
  }),
  tags: text("tags").array().default([]),
  visibility: text("visibility", { enum: ["private", "unlisted", "public"] })
    .notNull()
    .default("private"),
  reviewStatus: text("review_status", { enum: ["none", "pending", "approved", "rejected"] })
    .notNull()
    .default("none"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const storyCharacters = pgTable(
  "story_characters",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    talkativeness: real("talkativeness").notNull().default(0.5),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.characterId] })],
);

export const NODE_KINDS = [
  "character",
  "user",
  "npc",
  "place",
  "item",
  "event",
  "group",
  "concept",
] as const;
export const MEMORY_KINDS = ["fact", "event", "promise", "secret", "preference", "status"] as const;
export const ORIGINS = ["canon", "auto", "user"] as const;

export const canonNodes = pgTable("canon_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: NODE_KINDS }).notNull(),
  name: text("name").notNull(),
  aliases: text("aliases").array().default([]),
  summary: text("summary"),
  characterId: uuid("character_id").references(() => characters.id, { onDelete: "set null" }),
  isUser: boolean("is_user").notNull().default(false),
});

export const canonEdges = pgTable("canon_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  src: uuid("src")
    .notNull()
    .references(() => canonNodes.id, { onDelete: "cascade" }),
  dst: uuid("dst")
    .notNull()
    .references(() => canonNodes.id, { onDelete: "cascade" }),
  relation: text("relation").notNull(),
  description: text("description"),
  affinity: integer("affinity"),
  directed: boolean("directed").default(true),
});

export const canonMemories = pgTable("canon_memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  kind: text("kind", { enum: MEMORY_KINDS }).notNull().default("fact"),
  importance: integer("importance").default(3),
  subjectNodeIds: uuid("subject_node_ids").array().default([]),
  knowerNodeIds: uuid("knower_node_ids").array(), // null = 모두 앎
});

// ───────────── 페르소나 ─────────────
export const personas = pgTable("personas", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
});

// ───────────── 채팅방 ─────────────
export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  personaId: uuid("persona_id").references(() => personas.id, { onDelete: "set null" }),
  title: text("title"),
  summary: text("summary").default(""),
  summaryLocked: boolean("summary_locked").default(false),
  summaryUptoSeq: seq("summary_upto_seq").default(0),
  extractedUptoSeq: seq("extracted_upto_seq").default(0),
  nextSeq: seq("next_seq").notNull().default(1),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const roomParticipants = pgTable(
  "room_participants",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    inScene: boolean("in_scene").notNull().default(true),
    talkativeness: real("talkativeness").notNull().default(0.5),
    nodeId: uuid("node_id").references(() => memNodes.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.roomId, t.characterId] })],
);

// ───────────── 메시지 ─────────────
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  seq: seq("seq").notNull(),
  variant: integer("variant").notNull().default(0),
  isSelected: boolean("is_selected").notNull().default(true),
  role: text("role", { enum: ["user", "character", "narrator", "system"] }).notNull(),
  characterId: uuid("character_id").references(() => characters.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  whisperTo: uuid("whisper_to").array(),
  isOoc: boolean("is_ooc").notNull().default(false),
  presentCharacterIds: uuid("present_character_ids").array().notNull().default([]),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  flagged: boolean("flagged").notNull().default(false),
  createdAt: createdAt(),
});

// ───────────── 기억 그래프 ─────────────
export const memNodes = pgTable("mem_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: NODE_KINDS }).notNull(),
  name: text("name").notNull(),
  aliases: text("aliases").array().notNull().default([]),
  summary: text("summary").default(""),
  attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
  characterId: uuid("character_id").references(() => characters.id, { onDelete: "set null" }),
  origin: text("origin", { enum: ORIGINS }).notNull(),
  locked: boolean("locked").notNull().default(false),
  status: text("status", { enum: ["active", "invalidated", "merged"] })
    .notNull()
    .default("active"),
  mergedInto: uuid("merged_into"),
  sourceSeqs: seqArray("source_seqs"),
  layout: jsonb("layout").$type<{ x: number; y: number }>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memEdges = pgTable("mem_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  src: uuid("src")
    .notNull()
    .references(() => memNodes.id, { onDelete: "cascade" }),
  dst: uuid("dst")
    .notNull()
    .references(() => memNodes.id, { onDelete: "cascade" }),
  relation: text("relation").notNull(),
  description: text("description").default(""),
  affinity: integer("affinity"),
  directed: boolean("directed").notNull().default(true),
  origin: text("origin", { enum: ORIGINS }).notNull(),
  locked: boolean("locked").notNull().default(false),
  status: text("status", { enum: ["active", "superseded", "invalidated"] })
    .notNull()
    .default("active"),
  supersededBy: uuid("superseded_by"),
  validFromSeq: seq("valid_from_seq"),
  validToSeq: seq("valid_to_seq"),
  sourceSeqs: seqArray("source_seqs"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  kind: text("kind", { enum: MEMORY_KINDS }).notNull().default("fact"),
  importance: integer("importance").notNull().default(3),
  knowledge: text("knowledge", { enum: ["everyone", "scoped"] })
    .notNull()
    .default("scoped"),
  storyTime: text("story_time"),
  origin: text("origin", { enum: ORIGINS }).notNull(),
  locked: boolean("locked").notNull().default(false),
  pinned: boolean("pinned").notNull().default(false),
  status: text("status", { enum: ["active", "superseded", "invalidated"] })
    .notNull()
    .default("active"),
  supersededBy: uuid("superseded_by"),
  sourceSeqs: seqArray("source_seqs"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  useCount: integer("use_count").notNull().default(0),
  embedding: vector("embedding", { dimensions: 768 }), // v1
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memorySubjects = pgTable(
  "memory_subjects",
  {
    memoryId: uuid("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => memNodes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.memoryId, t.nodeId] })],
);

export const memoryKnowers = pgTable(
  "memory_knowers",
  {
    memoryId: uuid("memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => memNodes.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.memoryId, t.nodeId] })],
);

export const memoryOps = pgTable("memory_ops", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  jobId: uuid("job_id"),
  actor: text("actor", { enum: ["auto", "user", "system"] }).notNull(),
  op: text("op").notNull(),
  targetTable: text("target_table").notNull(),
  targetId: uuid("target_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  status: text("status", { enum: ["applied", "proposed", "rejected", "reverted"] })
    .notNull()
    .default("applied"),
  createdAt: createdAt(),
});

export const memoryJobs = pgTable("memory_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["extract", "summarize", "invalidate_after"] }).notNull(),
  fromSeq: seq("from_seq"),
  toSeq: seq("to_seq"),
  status: text("status", { enum: ["queued", "running", "done", "failed"] })
    .notNull()
    .default("queued"),
  attempts: integer("attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  error: text("error"),
  createdAt: createdAt(),
});

export const generationLogs = pgTable("generation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").references(() => rooms.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(), // chat / extract / summarize / moderate
  model: text("model").notNull(),
  prompt: jsonb("prompt").notNull(),
  injectedMemoryIds: uuid("injected_memory_ids").array().default([]),
  injectedEdgeIds: uuid("injected_edge_ids").array().default([]),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cachedTokens: integer("cached_tokens"),
  ttftMs: integer("ttft_ms"),
  totalMs: integer("total_ms"),
  finishReason: text("finish_reason"),
  error: text("error"),
  createdAt: createdAt(),
});

export const roomSummaries = pgTable("room_summaries", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  uptoSeq: seq("upto_seq").notNull(),
  text: text("text").notNull(),
  createdAt: createdAt(),
});

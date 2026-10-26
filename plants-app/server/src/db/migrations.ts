// סכימה אחת שרצה גם על SQLite וגם על Postgres: מזהים כ-TEXT, תאריכים כמחרוזות ISO, JSON כ-TEXT.
export const MIGRATIONS: string[] = [
  `create table if not exists users(
     id text primary key, email text not null unique, pass_hash text not null, created_at text not null)`,
  `create table if not exists profiles(
     user_id text primary key, home text not null default '{}', push_subs text not null default '[]',
     tz text not null default 'Asia/Jerusalem')`,
  `create table if not exists photos(
     id text primary key, user_id text not null, plant_id text, kind text not null,
     mime text not null, data text not null, created_at text not null)`,
  `create table if not exists plants(
     id text primary key, user_id text not null, nickname text not null, common_name_he text,
     scientific_name text, location text, notes text, care text, toxicity text,
     water_every_days integer, feed_every_days integer, last_watered text, last_fed text,
     cover_photo_id text, created_at text not null)`,
  `create table if not exists diagnoses(
     id text primary key, user_id text not null, plant_id text, photo_id text, description text,
     result text not null, severity text not null, created_at text not null)`,
  `create table if not exists care_tasks(
     id text primary key, user_id text not null, plant_id text not null, type text not null,
     due_date text not null, done_at text, notified_at text)`,
  `create table if not exists growth_entries(
     id text primary key, user_id text not null, plant_id text not null, photo_id text,
     note text, diagnosis_id text, created_at text not null)`,
  `create index if not exists idx_plants_user on plants(user_id)`,
  `create index if not exists idx_tasks_user_due on care_tasks(user_id, due_date)`,
  `create index if not exists idx_photos_user on photos(user_id)`,
];

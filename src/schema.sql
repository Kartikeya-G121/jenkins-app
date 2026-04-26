CREATE TABLE IF NOT EXISTS repositories (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS builds (
  id UUID PRIMARY KEY,
  repository_id UUID REFERENCES repositories(id),
  ref VARCHAR(255) NOT NULL,
  commit_id CHAR(40) NOT NULL,
  commit_message TEXT,
  author VARCHAR(255),
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stages (
  id UUID PRIMARY KEY,
  build_id UUID REFERENCES builds(id),
  name VARCHAR(128) NOT NULL,
  "order" INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL,
  commands JSONB NOT NULL,
  logs TEXT NOT NULL DEFAULT '',
  exit_code INTEGER,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  "when" VARCHAR(32)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY,
  build_id UUID REFERENCES builds(id),
  path VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

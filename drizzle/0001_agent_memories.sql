-- Agent Memory System (MiroFish gap P0-1)
-- Run manually via psql against Supabase

CREATE TABLE shanks.agent_memories (
  id serial PRIMARY KEY,
  agent_id integer NOT NULL REFERENCES shanks.agents(id),
  project_id integer NOT NULL REFERENCES shanks.projects(id),
  round integer NOT NULL,
  memory_type text NOT NULL DEFAULT 'action_summary',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_memories_agent_project ON shanks.agent_memories(agent_id, project_id, round);

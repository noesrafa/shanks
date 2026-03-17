# Shanks

Motor de predicción con agentes LLM, inspirado en OASIS + MiroFish.
Replica la arquitectura de ambos proyectos inhouse, sin depender de su código.

## Referencia
- OASIS (motor de simulación social): /Users/rafael/works/oasis-reference
- MiroFish (producto de predicción): github.com/666ghj/MiroFish
- Documento del proyecto: PROJECT.md (pipeline completo, modelo de datos, roadmap)

Siempre consulta la referencia antes de implementar cualquier funcionalidad.
No inventes mecánicas que no existan en OASIS o MiroFish sin preguntar primero.

## Stack
- SvelteKit + TypeScript
- Supabase (PostgreSQL), schema `shanks`
- Drizzle ORM (NO usar drizzle-kit push/migrate, crear tablas manualmente via psql)
- MiniMax M2.5 (API, OpenAI-compatible)
- Ollama + Qwen 3 14B (alternativa local)

## DB
- Schema: `shanks` en Supabase
- Crear tablas via psql, nunca via migraciones automáticas
- psql: /opt/homebrew/Cellar/libpq/18.3/bin/psql "postgresql://supabase_admin.87608c9a427eefa1:...@db.soyrafa.dev:5432/postgres"

## Git
- SIEMPRE commitea y pushea TODOS los archivos que modifiques, sin excepción
- Nunca dejes cambios sin commitear — el próximo pull o deploy los sobreescribe
- Trabaja directamente en /projects/shanks, NO clones a /tmp/
- Haz commits atómicos y descriptivos
- SIEMPRE verifica que el build funcione (`npm run build`) antes de considerar el trabajo terminado
- NUNCA pushes directo a main — siempre crea una branch descriptiva (ej: `feat/add-predictions-page`)
- Crea un PR a main usando `gh pr create` cuando termines
- NUNCA mergees tú mismo — asigna el issue al MR Reviewer para que revise y mergee

## Principios
- Fiel a OASIS + MiroFish: adaptar, no inventar
- Incremental: un sprint a la vez
- Simple: no sobreingenieriear
- Inhouse: cero dependencias de OASIS o MiroFish como código

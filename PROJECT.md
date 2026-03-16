# Shanks — Motor de predicción con agentes LLM

## Qué es

Un motor de predicción inhouse que simula interacciones sociales con agentes LLM
para predecir cómo reaccionaría la gente ante cualquier escenario: noticias,
políticas, movimientos de mercado, lanzamientos de producto, etc.

Basado en la arquitectura de **MiroFish** (el producto) y **OASIS** (el motor de
simulación), replicado desde cero en nuestro stack sin depender de ninguno de los dos.

## Referencia

| Proyecto | Rol | Repo |
|----------|-----|------|
| OASIS (CAMEL-AI) | Motor de simulación social (agentes + plataforma + acciones) | /Users/rafael/works/oasis-reference |
| MiroFish | Producto completo: seed → graph → agentes → simulación → reporte | github.com/666ghj/MiroFish |

**Regla**: toda funcionalidad debe basarse en cómo lo hacen OASIS o MiroFish.
No inventar lógica nueva sin consultar primero.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | SvelteKit + TypeScript |
| Backend/API | SvelteKit server (endpoints) |
| Base de datos | Supabase (PostgreSQL), schema `shanks` |
| ORM | Drizzle |
| LLM | MiniMax M2.5 (API, OpenAI-compatible) |
| LLM local (opcional) | Ollama + Qwen 3 14B |
| Knowledge graph | Por definir (Supabase pgvector o servicio externo) |

## Pipeline (adaptado de MiroFish)

MiroFish tiene 5 stages. Los replicamos adaptados a nuestro stack:

### Stage 1 — Ingesta y Knowledge Graph

**MiroFish**: El usuario sube documentos (PDF/MD/TXT) + una pregunta de predicción.
Un LLM genera una ontología (10 tipos de entidad + 6-10 tipos de relación).
Luego usa Zep Cloud para construir el knowledge graph automáticamente desde el texto.

**Nosotros**: Mismo flujo. El usuario sube seed material + escribe su pregunta.
El LLM genera la ontología. Construimos el graph en nuestra propia DB
(tabla de nodos + tabla de edges, o pgvector para búsqueda semántica).

Datos clave que extrae MiroFish:
- **Entidades**: uuid, nombre, tipo (Person, Organization, etc.), summary, atributos
- **Relaciones**: source → target, tipo, fact (texto), timestamps
- **Regla de MiroFish**: las entidades deben ser actores reales capaces de
  comportamiento en redes sociales, nunca conceptos abstractos

### Stage 2 — Generación de agentes

**MiroFish**: Lee las entidades del graph. Para cada una, hace una búsqueda híbrida
en el graph para enriquecer contexto, y llama al LLM para generar un perfil completo:

```
OasisAgentProfile:
  - name, bio (200 chars), persona (2000 chars detallado)
  - age, gender, mbti, country, profession
  - interested_topics[]
  - stance (supportive/opposing/neutral/observer)
  - activity_level (0-1), influence_weight
  - active_hours[], response_delay
  - source_entity_uuid (referencia al nodo del graph)
```

Clasifica entidades en "individuales" (personas) vs "grupales" (organizaciones,
medios) y usa prompts distintos para cada tipo. Las organizaciones generan un
"representante de cuenta oficial".

**MiroFish** también genera configuración de simulación via LLM:
- Tiempo total (24-168 horas simuladas), minutos por ronda
- Multiplicadores de actividad por hora del día
- Posts iniciales (seed posts que arrancan la conversación)
- Hot topics y dirección narrativa

**Nosotros**: Mismo flujo. Entidad del graph → búsqueda de contexto → LLM genera
perfil completo. Guardamos los perfiles en tabla `users` extendida.

### Stage 3 — Simulación

**OASIS** (el motor que usa MiroFish):
1. `reset()` — registrar agentes en la plataforma
2. `update_rec_table()` — actualizar recomendaciones
3. `step(actions)` — cada agente:
   a. Recibe system message con su personalidad
   b. Recibe user message con el estado del entorno (posts en JSON)
   c. El LLM decide qué acción tomar via tool calling
   d. La acción se ejecuta y modifica el estado
4. Repetir por N rondas

**Action space de OASIS** (Twitter defaults):
- CREATE_POST, LIKE_POST, REPOST, QUOTE_POST, FOLLOW, DO_NOTHING

**Action space de OASIS** (Reddit defaults):
- Lo anterior + CREATE_COMMENT, DISLIKE_POST, LIKE_COMMENT, DISLIKE_COMMENT,
  SEARCH_POSTS, SEARCH_USER, TREND, REFRESH, MUTE

**MiroFish** agrega sobre OASIS:
- Selección de agentes activos por ronda según hora simulada y activity_level
- Simulación dual (Twitter + Reddit en paralelo)
- Actualización dinámica del knowledge graph durante la simulación
  (cada acción se convierte en texto y se inyecta al graph)
- Logging de acciones en JSONL para monitoreo en tiempo real

**Nosotros**: Replicamos el loop de OASIS en TypeScript.
- Una plataforma (tipo Twitter) es suficiente para empezar
- Agentes activos por ronda basado en config
- Tool calling para decidir acciones
- Acciones modifican la DB
- Log de acciones por ronda

### Stage 4 — Reporte de predicción

**MiroFish**: Un `ReportAgent` con patrón ReACT:
1. **Planificación**: recibe stats de la simulación, genera outline (2-5 secciones)
2. **Por sección**: loop ReACT con 3-5 tool calls obligatorios antes de escribir
   - Tools: `insight_forge` (búsqueda profunda), `panorama_search` (vista completa),
     `quick_search` (búsqueda rápida), `interview_agents` (entrevistar agentes)
3. **Output**: reporte en markdown con citas de los agentes

**Nosotros**: Mismo patrón. El ReportAgent tiene acceso a:
- El knowledge graph actualizado (con eventos de la simulación)
- Los logs de acciones
- Capacidad de "entrevistar" agentes (re-invocar el LLM con el perfil del agente)

### Stage 5 — Interacción

**MiroFish**:
- Chat con el ReportAgent (tiene el reporte como contexto)
- Entrevistas directas con agentes individuales
- Capacidad de inyectar nuevas variables y re-correr escenarios

**Nosotros**: Chat en la UI post-reporte. Entrevistas con agentes.

## Modelo de datos

### Tablas actuales (Sprint 1-2)

```
shanks.users     (id, name, bio, interests)
shanks.posts     (id, user_id, content, num_likes, created_at)
shanks.likes     (id, user_id, post_id, created_at)
```

### Tablas futuras (por sprint)

```
-- Knowledge graph
shanks.projects        (id, name, seed_text, requirement, status, created_at)
shanks.graph_nodes     (id, project_id, name, entity_type, summary, attributes jsonb)
shanks.graph_edges     (id, project_id, source_node_id, target_node_id, edge_type, fact, created_at)

-- Agentes extendidos (MiroFish OasisAgentProfile)
shanks.agents          (id, project_id, user_id, persona, age, gender, mbti,
                            country, profession, interested_topics text[],
                            stance, activity_level, influence_weight,
                            source_node_id, created_at)

-- Simulación
shanks.simulations     (id, project_id, status, total_rounds, current_round,
                            config jsonb, created_at)
shanks.action_log      (id, simulation_id, round_num, agent_id,
                            action_type, action_args jsonb, created_at)

-- Posts extendidos
shanks.comments        (id, post_id, user_id, content, num_likes, created_at)
shanks.follows         (id, follower_id, followee_id, created_at)
shanks.reposts         (id, user_id, original_post_id, content, created_at)

-- Reportes
shanks.reports         (id, simulation_id, status, outline jsonb,
                            content text, created_at)
shanks.report_sections (id, report_id, section_num, title, content, created_at)
```

## Roadmap por sprints

### Sprint 1 — Esqueleto mínimo ✅
- Proyecto SvelteKit + Drizzle + Supabase
- Schema básico (users, posts)
- Clase Agent con generatePost() via LLM
- Endpoint POST /api/simulate
- UI con botón Simular y feed

### Sprint 2 — Agentes reactivos ✅
- Tabla likes + num_likes en posts
- Agente observa el feed (como OASIS to_text_prompt)
- LLM decide acción via tool calling (create_post, like_post, do_nothing)
- Action log en la UI

### Sprint 3 — Comentarios + más agentes
- Tabla comments
- Acción CREATE_COMMENT en el action space
- 5-8 agentes con perfiles más diversos
- Posts muestran comentarios anidados

### Sprint 4 — Follows + feed personalizado
- Tabla follows
- Acciones FOLLOW/UNFOLLOW
- Feed filtrado por follows (como OASIS rec table)
- Cada agente ve un feed distinto

### Sprint 5 — Knowledge graph + seed material
- Tablas projects, graph_nodes, graph_edges
- UI para subir documentos + escribir pregunta
- LLM genera ontología (como MiroFish Stage 1)
- Extracción de entidades y relaciones del texto

### Sprint 6 — Generación automática de agentes
- Entidades del graph → perfiles de agente via LLM
- Tabla agents extendida (persona, stance, activity_level, etc.)
- Config de simulación generada por LLM

### Sprint 7 — Simulación multi-ronda
- Tabla simulations + action_log
- Loop de simulación configurable (N rondas)
- Selección de agentes activos por ronda
- Monitoreo en tiempo real desde la UI

### Sprint 8 — ReportAgent
- Tabla reports + report_sections
- Patrón ReACT: planificación + generación por sección
- Tools: búsqueda en graph, búsqueda en action_log, entrevista a agentes
- Reporte en markdown

### Sprint 9 — Interacción post-reporte
- Chat con ReportAgent
- Entrevistas directas con agentes
- Re-correr escenarios con variables inyectadas

### Sprint 10 — Pulido y optimización
- UI completa con wizard de 5 pasos (como MiroFish)
- Visualización del knowledge graph
- Historial de simulaciones
- Performance y caching

## Principios

1. **Fiel a OASIS + MiroFish**: adaptar, no inventar
2. **Incremental**: un sprint a la vez, cada uno funcional
3. **Simple**: no sobreingenieriear. Si MiroFish lo hace complejo y podemos
   simplificarlo sin perder la esencia, simplificamos
4. **Inhouse**: cero dependencias de OASIS o MiroFish como código.
   Solo usamos sus ideas y arquitectura como referencia

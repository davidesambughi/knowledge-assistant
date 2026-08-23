-- 02-retrieval.md — da eseguire manualmente su Supabase SQL editor (stesso pattern di 00-project-setup.md,
-- nessuna cartella di migrazioni nel progetto). File tenuto come riferimento/audit trail, non eseguito
-- automaticamente da nessuno script.

-- 1. Full-text search: colonna generata + indice GIN (lingua italian, corpus Remote NIF è in italiano).
alter table document_chunks
  add column if not exists fts tsvector
  generated always as (to_tsvector('italian', content)) stored;

create index if not exists document_chunks_fts_idx
  on document_chunks using gin (fts);

-- 2. Naive similarity search (cosine, pgvector). PostgREST non espone l'operatore <=> direttamente,
-- va incapsulato in una funzione Postgres chiamata via supabase.rpc(...).
create or replace function match_documents (
  query_embedding vector(1536),
  match_count int
)
returns table (
  id uuid,
  source_file text,
  heading_path text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    id,
    source_file,
    heading_path,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from document_chunks
  order by embedding <=> query_embedding asc
  limit match_count;
$$;

-- 3. Hybrid search: vettoriale + full-text, fusi via Reciprocal Rank Fusion.
create or replace function hybrid_search (
  query_text text,
  query_embedding vector(1536),
  match_count int,
  full_text_weight float default 1,
  semantic_weight float default 1,
  rrf_k int default 50
)
returns table (
  id uuid,
  source_file text,
  heading_path text,
  content text,
  similarity float
)
language sql stable
as $$
  with vector_results as (
    select
      id,
      row_number() over (order by embedding <=> query_embedding asc) as rank
    from document_chunks
    order by embedding <=> query_embedding asc
    limit least(match_count * 5, 50)
  ),
  text_results as (
    select
      id,
      row_number() over (order by ts_rank_cd(fts, websearch_to_tsquery('italian', query_text)) desc) as rank
    from document_chunks
    where fts @@ websearch_to_tsquery('italian', query_text)
    order by ts_rank_cd(fts, websearch_to_tsquery('italian', query_text)) desc
    limit least(match_count * 5, 50)
  ),
  fused as (
    select
      coalesce(v.id, t.id) as id,
      coalesce(semantic_weight * (1.0 / (rrf_k + v.rank)), 0)
        + coalesce(full_text_weight * (1.0 / (rrf_k + t.rank)), 0) as score
    from vector_results v
    full outer join text_results t on v.id = t.id
  )
  select
    dc.id,
    dc.source_file,
    dc.heading_path,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from fused
  join document_chunks dc on dc.id = fused.id
  order by fused.score desc
  limit match_count;
$$;

# 09 — CSV Import

## Format

```csv
term,meaning,reading,example,notes
食べる,to eat,たべる,ご飯を食べる,ichidan verb
生活,"life, living",せいかつ,,
コーヒー,coffee,こーひー,,
ありがとう,thank you,,,
```

```csv
term,meaning,pinyin
学习,to study,xuéxí
是,to be,shì
```

- **Encoding:** UTF-8. A leading BOM (U+FEFF) is stripped, because Excel adds one. Any other encoding is rejected with a hint: "Save as CSV UTF-8".
- **Header:** required. Column names are case-insensitive and may come in any order. `term` and `meaning` are required; `reading`, `example`, and `notes` are optional. `hiragana`, `pinyin`, and `jyutping` are accepted as aliases for `reading`. Unknown columns cause a rejection, so typos are caught.
- **Dialect:** RFC 4180. Values can be quoted, a doubled quote (`""`) escapes a quote, and quoted values can span lines. Lines may end in CRLF or LF. The delimiter is always a comma.
- **Limits:**
  - 5 MB, enforced by the multipart `maxFileSize` limit on the contract's `ImportCsv` payload, which returns 413 before parsing starts
  - 20,000 rows
  - the field lengths from the Word Schemas (enforced in code, see [06](06-data-model.md))
- **Language:** taken from the Deck (`termLang`, `meaningLang`). There is no per-row language.

## Pipeline (synchronous, one transaction)

```
multipart file ─▶ bytes ─▶ TextDecoder("utf-8", {fatal:true})   ── invalid UTF-8 ⇒ 422
             ─▶ parseCsv (pure, RFC 4180)                       ── Either<CsvError[], Row[]>
             ─▶ Schema.decode each Row → NewWord                 ── collect all errors (≤100 reported)
             ─▶ normalize keys; drop in-file duplicates (count)
             ─▶ sql.withTransaction(
                  INSERT INTO words … SELECT * FROM unnest($terms, $readings, …)
                    ON CONFLICT (deck_id, term_key, reading_key) WHERE deleted_at IS NULL
                    DO NOTHING RETURNING id )                 -- no cards: created lazily per drill
             ─▶ { imported, skippedDuplicates }
```

- **All or nothing.** If any row fails validation, nothing is written. This is easier to reason about than a partial import: the Learner fixes the file and uploads it again, and duplicates are skipped on the second attempt anyway.
- **Bulk insert with `unnest`.** One statement inserts every row in a single round trip, with no batching loop. Twenty thousand rows take well under a second.
- **Memory:** a 5 MB file is about 10 MB as JS strings, plus the parsed rows (about 15 MB). That is transient and fine within a 512 MiB limit. A double-submitted import is harmless: the second one skips every row as a duplicate. Traefik rate-limits the import route to 5 requests per minute per IP, which bounds memory use if someone abuses it.

## Is beanstalkd needed?

**Decision: no, not in the MVP** (confirmed, ADR 7). It will be considered again at scale.

| | Synchronous (recommended) | beanstalkd worker |
|---|---|---|
| Latency for 5 MB / 20k rows | ~0.5–1.5 s within the request | Same work, plus job status polling in the UI |
| Infrastructure | none | A beanstalkd pod and a worker process (or a fiber) |
| Failure handling | Transaction rollback, user retries | Retries, dead jobs (buried), and a job status table |
| Code | ~1 use case | Use case + producer + consumer + client library (the `fivebeans` and `beanstalkd` npm clients are unmaintained) + status endpoint |
| Fits within a request timeout? | Yes. Traefik's default is 60 s or more | n/a |

A 5 MB cap is small enough that a queue adds infrastructure, a status endpoint, a polling UI, and an unmaintained client library without solving any real problem.

**When to revisit:** add asynchronous processing if imports grow large (for example 50 MB files, or slow enrichment such as fetching TTS audio). Even then, start with a Postgres-backed queue (a `jobs` table read with `FOR UPDATE SKIP LOCKED`, processed by an Effect fiber in the API). That adds no new infrastructure. Move to beanstalkd only if the job volume outgrows Postgres.

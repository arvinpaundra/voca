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

## Several decks at once (FR-29, ADR 59)

A single-deck import stays synchronous, as above. A batch of up to 50 files would hold a request for tens of seconds, so it runs on **beanstalkd**:

```
POST /imports (multipart) ─▶ one transaction: import_batches row + one import_files row per file (bytes in `content`)
                          ─▶ put one job per file, body {fileId}            -- a job is capped at 64 KiB, the file is not
worker fiber (in the API) ─▶ reserve ─▶ mark the file running, publish {batch, status: "running"}
                          ─▶ the pipeline above, into a new deck named after the file
                          ─▶ one transaction: create deck + insert words + file done (counts), or file failed (errors)
                          ─▶ clear `content`, delete the job, publish the event ("finished" after the batch's last file)
```

- **Each file is all-or-nothing on its own.** A failed file creates no deck; the others still do.
- **At least once.** A job comes back when its TTR expires (the pod died mid-file). The worker skips a file that is already `done` or `failed`, so it imports once. A defect buries the job.
- **Progress lives in Postgres**, so it survives a reload and a sign-out. The SSE events only say that a batch changed; the frontend refetches `GET /imports`.
- **Memory:** one request carries up to 50 MB in all (50 files, each ≤ 5 MB). The handler sums the files' sizes on disk and refuses the batch (413) before reading any file into memory; the bytes and their bytea parameters peak near 150 MB. The route's rate limit bounds how many run at once.

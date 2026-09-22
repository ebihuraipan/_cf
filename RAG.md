# RAGデモ(`add_rag`ブランチ)

Vectorize + Workers AIによるRAG(検索拡張生成)デモ。Nuxt/CloudflareのデプロイまわりのMEMOは[`DEPLOY_LINKAGE.md`](./DEPLOY_LINKAGE.md)を参照。

## 構成

- 埋め込みモデル: `@cf/baai/bge-m3`(1024次元、多言語/日本語対応)
- 生成モデル: `@cf/meta/llama-3.1-8b-instruct-fp8`
- Vectorizeインデックス: `cf-rag-index-ja`(1024次元、cosine)
- スコープ: API(Nitro server routes)のみ。画面は未実装(APIとUIは疎結合なので後付け可能)

## エンドポイント

### `POST /api/auth/login` — 合言葉によるログイン

`nuxt/server/api/auth/login.post.ts`。`{"passphrase": "..."}`を`env.PASSPHRASE`(secret)と比較し、一致すればh3の`useSession`(`nuxt/server/utils/session.ts`)でsealed cookieセッションに`{authenticated: true}`を保存。サーバー側ストレージ(KV等)は不要。

```bash
curl -c cookie.txt -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"passphrase": "<合言葉>"}'
```

```json
{"ok": true}
```

不一致なら401。以降`/api/ingest`・`/api/query`は`curl -b cookie.txt ...`のように発行済みcookieを付けてアクセスする。

### `POST /api/ingest` — 文書登録

`nuxt/server/api/ingest.post.ts`。`nuxt/server/utils/chunk.ts`で段落単位→500文字区切りにチャンク分割し、`bge-m3`で埋め込み生成後、`cf-rag-index-ja`に登録(`metadata.text`に元チャンクを保持)。

```bash
curl -X POST http://localhost:8787/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"text": "富士山は日本で一番高い山で、標高は3776メートルです。\n\n東京はかつて江戸と呼ばれ、日本の首都です。"}'
```

```json
{"inserted":2,"ids":["...","..."]}
```

### `POST /api/query` — 質問応答

`nuxt/server/api/query.post.ts`。質問を`bge-m3`で埋め込み→Vectorizeで類似チャンク検索(`topK`, デフォルト3)→検索結果をコンテキストとして`llama-3.1-8b-instruct-fp8`で回答生成。

```bash
curl -X POST http://localhost:8787/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "富士山の高さは？"}'
```

```json
{
  "answer": "3776メートルです。",
  "matches": [
    {"score": 0.7357, "text": "富士山は日本で一番高い山で、標高は3776メートルです。"},
    {"score": 0.3852, "text": "東京はかつて江戸と呼ばれ、日本の首都です。"}
  ]
}
```

## セットアップ(初回のみ)

```bash
cd nuxt
bunx wrangler vectorize create cf-rag-index-ja --dimensions=1024 --metric=cosine
bunx wrangler types   # wrangler.jsonc変更後は再実行
```

`nuxt/wrangler.jsonc`に`ai`(binding: `AI`)と`vectorize`(binding: `VECTORIZE`, index_name: `cf-rag-index-ja`, `remote: true`)を設定済み。

## 注意点

- **RAG API(`/api/ingest`, `/api/query`)は合言葉認証が必要**: `nuxt/server/middleware/auth.ts`が全リクエストを見て、この2パスのみをガード(`/api/auth/login`自体はガード対象外)。未認証時は`401`ではなく`404`を返し、保護対象の存在自体を伏せる
- **secretはコミットしない**: `PASSPHRASE`(合言葉本体)と`SESSION_SECRET`(セッションcookie署名用、32byte以上のランダム文字列)の2つが必要。ローカルは`nuxt/.dev.vars`(gitignore済み、`wrangler dev`が自動読み込み)、本番は`bunx wrangler secret put PASSPHRASE` / `bunx wrangler secret put SESSION_SECRET`で設定する。`.dev.vars`を作成/変更したら`bunx wrangler types`を再実行して`Env`型に反映させること
- **Vectorizeはlocal dev非対応**: `wrangler.jsonc`のvectorize bindingに`"remote": true`を指定し、ローカル実行時も本物のインデックスにリモート接続している
- **書き込み反映のタイムラグ**: `ingest`直後に`query`すると、登録したばかりのチャンクが検索結果に出ないことがある(数秒〜数十秒かかる場合あり)。画面を作る際はUXとして考慮が必要
- **Workers AIのモデルは定期的に廃止される**: 実装・変更時は`bunx wrangler ai models`で現行モデル一覧を確認すること
- **Vectorizeの次元数上限は1536**: 埋め込みモデル選定時は出力次元数を確認すること(例: `@cf/pfnet/plamo-embedding-1b`は2048次元のため利用不可)

## 次のステップ

- [ ] (任意)ブラウザからの簡単な操作画面
- [ ] CI/CD(`deploy.yml`)経由でのデプロイ確認(現状は手動`wrangler deploy`のみ検証済み)

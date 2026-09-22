# cf - Cloudflare Workers 学習用プロジェクト

Cloudflare Workersの練習用プロジェクト。最終目標はVectorize + Workers AIでRAGデモを作ること。

ロードマップ: Workers Hello World → KV → D1/R2(任意) → Vectorize → Workers AI + RAG

## ログイン

```
wrangler login
```

ブラウザでCloudflareアカウント認証が開くので許可する。確認は以下:

```
$ wrangler whoami
👋 You are logged in with an OAuth Token, associated with the email ...
```

## 構成

Nuxt(`nuxt/`ディレクトリ)をCloudflare Workers上で直接動かす構成。フロント画面とRAG API(Vectorize +
Workers AI、実装予定)を同一Workerにまとめている。パッケージマネージャは`nuxt/`配下のみbunを使用。

Nitroのビルドプリセットを`cloudflare_module`に設定(`nuxt/nuxt.config.ts`)しており、
`nuxt build`の出力(`.output/server/index.mjs`)がそのままWorkerのエントリーポイントになる
(`nuxt/wrangler.jsonc`の`main`)。

## ローカル実行(開発サーバー)

```
cd nuxt
bun run dev
```

`http://localhost:3000` で確認。

## ローカル実行(Cloudflare Workersランタイム上で確認)

```
cd nuxt
bun run build
bunx wrangler dev
```

`http://localhost:8787` で確認。`nuxt build`しないと`.output`が生成されず`wrangler dev`が起動しない点に注意。

初回、`wrangler.jsonc`の`compatibility_date`がインストールした`wrangler`(workerdバイナリ)のサポート範囲より
新しい日付だとエラーになる点に注意。

```
This Worker requires compatibility date "YYYY-MM-DD", but the newest date supported by
this server binary is "YYYY-MM-DD".
```

→ エラーメッセージに出てくる日付に`compatibility_date`を合わせる。

## workers.devサブドメインの登録(初回のみ・デプロイに必須)

`wrangler deploy`は、アカウントに`workers.dev`サブドメインが登録されていないと失敗する
(非対話環境だと自動で選べないため)。

Cloudflareダッシュボードの"Workers & Pages"のページで、サブドメイン名(任意の文字列でよい)を登録する。

## 合言葉認証用secretの登録(RAG API保護・初回のみ)

`/api/ingest`・`/api/query`は合言葉認証で保護されている(ローカルは`nuxt/.dev.vars`で設定、
`.gitignore`済みなのでリポジトリには含まれない)。本番デプロイ前に、同じ内容をCloudflare側の
secretとして登録する必要がある。

```
cd nuxt
bunx wrangler secret put PASSPHRASE
bunx wrangler secret put SESSION_SECRET
```

いずれも対話的に値の入力を求められるので、そのままプロンプトに入力してEnter
(値がコマンド履歴やログに残らない方式)。`wrangler.jsonc`には一切書き込まれず、
Cloudflare側で暗号化保存される。

登録済みsecretの一覧確認(値は表示されない、名前のみ):

```
bunx wrangler secret list
```

## デプロイ

```
cd nuxt
bun run build
bunx wrangler deploy
```

成功すると公開URLが表示される。

```
Deployed cf-hello-world triggers
  https://cf-hello-world.<subdomain>.workers.dev
```

## CI/CD(mainブランチへのpushで自動デプロイ)

`.github/workflows/deploy.yml`により、`main`ブランチへのpush時に`nuxt/`ディレクトリで
`bun install` → `bun run build` → `wrangler deploy`が自動実行される
(`wrangler-action`の`workingDirectory: nuxt`指定で`nuxt/`配下から実行)。

### 事前準備(初回のみ)

1. Cloudflareダッシュボードの"My Profile" → "API Tokens"で、対象Workerに`Editor`権限を持つAPIトークンを発行
   - ページ下部にR2用のアクセスキー・S3エンドポイントが同時に表示されることがあるが、R2を使わない場合は不要(保存しなくてよい)
2. 発行完了後に表示されるモーダルは要注意
   - **初期表示ではモーダル上部に"アカウント ID"のハッシュ値が見えており、これをAPIトークンと誤認しやすい**
   - モーダル内にスクロールがあり、その下に本来コピーすべき**APIトークン**の値が表示される
   - スクロールに気づかずアカウントIDだけコピーしてモーダルを閉じてしまうと、正しいトークンは再表示できない(再発行が必要)ので、必ず下までスクロールしてAPIトークンの値を確認してからコピー・クローズすること
3. GitHubリポジトリに`CLOUDFLARE_API_TOKEN`という名前でSecretsに登録

```
gh secret set CLOUDFLARE_API_TOKEN --body "<コピーしたトークン>"
```

### workflowの設定ポイント

`cloudflare/wrangler-action@v3`使用時のハマりどころ:

- `wranglerVersion`を明示的に`"4"`指定すること。指定しないと古いバージョン(3系)がインストールされ、`wrangler.jsonc`(JSONC)の`main`フィールドを読めず`Missing entry-point`エラーになる
- トークンは`env: CLOUDFLARE_API_TOKEN: ...`ではなく、`with: apiToken: ...`で渡すこと。env経由だと`wrangler`側に渡らず`CLOUDFLARE_API_TOKEN`未設定エラーになる

### トラブルシュート

- `Invalid format for Authorization header [code: 6111]` → トークンの値が誤っている(APIトークンではなくアカウントIDを貼っていた等)。ダッシュボードでAPIトークンの値を再確認して登録し直す
- Secretsが更新されたか怪しい場合は`gh secret list`の更新日時で確認する
- workflowを手動で再実行したい場合、`workflow_dispatch`トリガーが未設定なので`git commit --allow-empty -m "trigger"`等でpushして動かす

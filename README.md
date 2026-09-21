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

## ローカル実行

```
wrangler dev
```

`http://localhost:8787` で確認。

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

## デプロイ

```
wrangler deploy
```

成功すると公開URLが表示される。

```
Deployed cf-hello-world triggers
  https://cf-hello-world.<subdomain>.workers.dev
```

## CI/CD(mainブランチへのpushで自動デプロイ)

`.github/workflows/deploy.yml`により、`main`ブランチへのpush時に自動で`wrangler deploy`が実行される。

事前準備(初回のみ):

1. Cloudflareダッシュボードの"My Profile" → "API Tokens"で、対象Workerに`Editor`権限を持つAPIトークンを発行
2. GitHubリポジトリに`CLOUDFLARE_API_TOKEN`という名前でSecretsに登録

```
gh secret set CLOUDFLARE_API_TOKEN
```

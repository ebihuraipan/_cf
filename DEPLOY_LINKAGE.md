# Nuxt ↔ Cloudflare デプロイ先の連携

CI/CD(`.github/workflows/deploy.yml`)は「ソース展開 → bunインストール → Nuxtビルド → Cloudflareへデプロイ」という流れだが、
Nuxt側の成果物とCloudflareのデプロイ先(Worker)がどう紐づいているかは複数ファイルに分散しているため整理する。

## 1. どのCloudflare Workerにデプロイされるか

`nuxt/wrangler.jsonc`の`name`フィールドで決まる。

```jsonc
{
  "name": "cf-hello-world",   // ← デプロイ先Worker名
  "main": ".output/server/index.mjs",
  ...
}
```

Cloudflare側でこの名前のWorkerが存在しなければ新規作成、存在すれば上書きデプロイされる。
どのCloudflareアカウントに対してデプロイするかは、Secretsに登録した`CLOUDFLARE_API_TOKEN`(発行時に紐づくアカウント)で決まる。

## 2. どのビルド成果物をデプロイするか

Nuxt(Nitro)のビルドは`nuxt.config.ts`の`preset`指定で出力形式が変わる。

```ts
// nuxt/nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare_module'   // Cloudflare Workers向けモジュール形式で出力
  }
})
```

`bun run build`を実行すると、この設定に従って`nuxt/.output/`配下にCloudflare Workers互換の成果物が生成される。

- `nuxt/.output/server/index.mjs` … Workerのエントリーポイント(サーバーサイドロジック)
- `nuxt/.output/public/` … 静的アセット(JS/CSS/画像等)

これらを`wrangler.jsonc`側が参照する。

```jsonc
{
  "main": ".output/server/index.mjs",   // ← エントリーポイント
  "assets": {
    "directory": ".output/public",      // ← 静的アセット配信元
    "binding": "ASSETS"
  }
}
```

## 3. wranglerコマンドをどこで実行するか

`wrangler.jsonc`は`nuxt/`ディレクトリ直下にあるため、`wrangler`コマンドは`nuxt/`をカレントディレクトリとして実行する必要がある。

CI/CDでは`cloudflare/wrangler-action@v3`の`workingDirectory`入力でこれを指定している。

```yaml
# .github/workflows/deploy.yml
- name: Deploy to Cloudflare Workers
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    wranglerVersion: "4"
    workingDirectory: nuxt   # ← nuxt/wrangler.jsonc を見にいく
```

ローカルで手動デプロイする場合も同様に、`nuxt/`に移動してから実行する。

```bash
cd nuxt
bun run build
bunx wrangler deploy
```

## まとめ:設定の対応関係

| 決めたいこと | 設定箇所 |
|---|---|
| デプロイ先Worker名・アカウント | `nuxt/wrangler.jsonc`の`name` / Secretsの`CLOUDFLARE_API_TOKEN` |
| ビルド成果物の出力形式 | `nuxt/nuxt.config.ts`の`nitro.preset: 'cloudflare_module'` |
| デプロイするファイルの場所 | `nuxt/wrangler.jsonc`の`main` / `assets.directory` |
| wranglerの実行ディレクトリ | CI: `deploy.yml`の`workingDirectory: nuxt` / ローカル: `cd nuxt` |

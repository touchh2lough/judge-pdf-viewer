# 公開・オフライン運用メモ

## 目的

スマホで安定して使うには、HTTPSで公開されたURLから一度開き、`事前保存` を実行しておくのが現実的です。

`http://192.168...` のローカルLAN表示は動作確認には便利ですが、スマホブラウザではService Workerのオフライン保存が制限される場合があります。

## 推奨運用

1. HTTPSの公開先にアプリを置く
2. スマホで公開URLを開く
3. `事前保存` を押す
4. 検索できること、PDF原本を開けることを確認する
5. スマホのホーム画面に追加する

## 公開先候補

- Cloudflare Pages
- GitHub Pages
- Netlify

## 注意

このアプリは公式PDFを同梱しません。

各ユーザーが公式サイト等から入手したPDFを、自分のブラウザ内に登録して利用します。登録したPDFはIndexedDBに保存され、GitHubやCloudflare Pagesへアップロードされません。

## 公式PDFの自動取得用Worker

1. `worker/wrangler.toml` の `account_id` が公開先の個人アカウントであることを確認します。
2. `wrangler deploy --dry-run --config worker/wrangler.toml` でビルドを確認します。
3. `wrangler deploy --config worker/wrangler.toml` で `judge-pdf-updates` Workerを公開します。
4. 公開URLを `js/update-config.mjs` の `UPDATE_API_BASE` に設定し、GitHub Pages側のコードを公開します。
5. `/health` と `/v1/sources` を確認し、公開アプリで4資料の取得を試します。

Workerは公式ルールページを解析して最新PDFリンクを見つけ、対象4資料だけを中継します。本文・PDFは中継先に永続保存しません。認証情報・ジャッジ通信・任意のURLを受け付けません。CORS許可先はこのGitHub Pagesのオリジンとローカル8793番ポートです。公開先を変更した場合は `ALLOWED_ORIGINS` も変更します。

Service Workerのキャッシュは `core8` です。アプリ画面と必要なモジュールだけを事前保存します。更新APIはキャッシュを通らず、画面のオンライン再読み込みは最新HTMLを取得します。旧版を開いている場合は、オンラインで再読み込みし、新しいService Workerの有効化後にもう一度開き直してください。

外部公開する場合も、公開対象は `app/` フォルダだけにしてください。作業フォルダ直下に置いたPDFを一緒に公開しないように注意します。

## 紙資料との併用

紙資料を重視するジャッジには、このアプリを「裁定判断ツール」ではなく「公式PDF原本へ速く戻る索引」と説明します。

検索結果のテキストは入口であり、最終確認は `PDF原本を見せる` または `PDFを開く` で公式PDFページを表示して行います。

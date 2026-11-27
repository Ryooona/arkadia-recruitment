# Arkadia求人窓口（@158zkwys）求人応募 LIFF

公式LINE「Arkadia求人窓口（@158zkwys）」のトークから開く求人応募フォームです。

公開ページ：https://ryooona.github.io/arkadia-recruitment/

GitHubリポジトリ：https://github.com/Ryooona/arkadia-recruitment

応募者が送信すると、応募内容をまとめたFlex Messageが1通だけ同じ公式LINEトークへ届きます。
顔写真を添付した場合は、Flex Messageの上部に写真を表示します。通知・トーク一覧の表示は
`求人応募｜Poker Room Arkadia｜〇〇店` です。

## フォーム項目

- 希望の勤務店舗（Poker Room Arkadia｜船橋店／岐阜店／新潟店）を先頭に表示
- 姓、名、姓（かな）、名（かな）
- 生年月日、年齢（生年月日から自動表示）
- 性別（ジェンダー）：男性／女性／その他
- ポーカーディーラーのご経験、経験者向けの詳細
- 電話番号
- 顔写真（任意、画像のみ・5MB以内）
- アピールポイント
- 面接希望日時（第1〜第3希望）
  - 日付
  - 終日可能チェック
  - 終日可能でない場合は開始・終了時刻（30分単位）
- その他・備考

メールアドレスとプライバシーポリシー同意欄は、今回のLINE応募フォームには含めていません。

面接希望日時の下には、書類審査後の案内、対面またはオンラインでの実施、時間帯に余裕を持って入力する旨の注意書きを表示しています。

## 下書き保存と離脱警告

- 入力内容は同じ端末のブラウザへ24時間保存
- ページを離れる際は、ブラウザ標準の離脱確認を表示
- 送信完了時に下書きを削除
- 顔写真ファイルだけはブラウザに保存せず、再表示時に再選択

## Googleスプレッドシート記録

記録先は次のシートです。

https://docs.google.com/spreadsheets/d/1xQZ7iRbG5bT_onZ-IRDLR8cTvg_AYLWq6supT_0UvoM/edit

`応募者一覧` タブに、フォーム項目、面接希望3枠、LINEユーザー情報、顔写真のDriveリンク、LINE送信状態を記録します。メールアドレス列はありません。

バックエンド本体は [`backend/Code.gs`](backend/Code.gs) です。Apps Scriptとしてデプロイし、作成されたウェブアプリURLを `index.html` の `BACKEND_URL` に設定してください。顔写真の原本はDriveへ保存し、LINE表示用URLをFlexへ組み込みます。

## 本番設定

1. LINE DevelopersでLIFFアプリを作成する。
2. `chat_message.write` を有効にする。
3. `backend/Code.gs` をGoogle Apps Scriptへ貼り付ける。
4. Apps Scriptのウェブアプリを「自分として実行」「アクセスできるユーザー：全員」でデプロイする。
5. 発行されたウェブアプリURLを `index.html` の `BACKEND_URL` に設定する。
6. LINE Developersで発行したLIFF IDを `index.html` の `LIFF_ID` に設定する。
7. HTTPSで公開し、そのLIFF URLを公式LINEのリッチメニュー「応募する」に設定する。
8. 公式LINEの1対1トークからLIFFを開き、テスト応募を送信する。

共有シークレットを使う場合は、Apps Scriptの `CONFIG.SHARED_SECRET` と `index.html` の `BACKEND_SHARED_SECRET` に同じ値を設定します。不要な場合は両方空欄のままでも動作します。

## プレビューとテスト

- `?preview=1`：LINE送信とスプレッドシート送信を行わず、Flex MessageのJSONを確認
- `verify-line-message.cjs`：店舗名入りaltText、Flex Message、年齢、終日可能、30分刻み表示を検証

時刻候補は現在 `12:00〜24:00` の30分単位です。面接対応時間を限定する場合は、`index.html` の `INTERVIEW_TIME_START_MINUTES` と `INTERVIEW_TIME_END_MINUTES` を変更します。

顔写真をFlex内に表示するため、保存した顔写真はリンクを知っているユーザーが閲覧できるGoogle Driveリンクとして扱います。公式LINEの1対1トーク以外のブラウザから開いた場合、同じトークへ自動送信できません。本番では公式LINE内から開く導線に限定してください。

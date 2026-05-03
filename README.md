# Local Card Duel

Socket.IO を使った2人対戦対応のカードゲーム試作です。

## ローカル起動

```bash
npm install
npm start
```

起動後、ブラウザで `http://localhost:3000` を開きます。

## オンライン対戦

1. 片方が「部屋作成」を押す
2. 表示された部屋IDを相手に共有する
3. もう片方が部屋IDを入力して「参加」を押す
4. 2人そろうと自動で対戦開始

ゲーム状態はサーバーが管理します。各プレイヤーには自分用の公開状態だけが送られるため、相手の手札、山札順、裏向きの持ち物は見えません。

## Render

Render の Web Service として公開できます。

- Build Command: `npm install`
- Start Command: `npm start`
- Environment: Node
- Health Check Path: `/healthz`

`PORT` は Render から渡される値を `server.js` が自動で使います。

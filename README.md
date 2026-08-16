# S&P 500 Equity Risk Premium (ERP) Dashboard

S&P 500の株式リスクプレミアム（ERP）を歴史的データとリアルタイムデータを使って視覚化・検証するインタラクティブなダッシュボードです。

## 特徴

- **ハイブリッド・データモデル**: 
  - ロバート・シラー教授（イェール大学）の月次歴史データ（1871年〜2023年）
  - Yahoo Finance APIから取得する日次の最新リアルタイムデータ（2023年〜今日）
- **インタラクティブな3段チャート (Plotly.js)**:
  1. S&P 500 株価推移（対数スケール）
  2. 益回り (Earnings Yield) vs 10年国債利回り (10Y Treasury Yield)
  3. 株式リスクプレミアム (ERP = 益回り - 10年国債利回り)
- **歴史的危機のハイライト**:
  - ブラックマンデー（1987年）
  - ITバブル崩壊（1999〜2001年）
  - リーマンショック（2007〜2009年）
  - コロナショック（2020年）
  - 金融引き締め局面（2022年〜現在）
- **スマートキャッシュ機構**:
  - Yahoo Financeのレート制限を回避するための15分間キャッシュ。
  - ヘッダーの「🔄 更新」ボタンによる最新データの強制取得機能（キャッシュバイパス）。
- **洗練されたダークテーマデザイン**: 金融ツールに最適なグラスモーフィズムデザイン。

## 必要要件

- Node.js (v18以上推奨)
- npm

## セットアップ手順

1. 依存関係のインストール:
   ```bash
   npm install
   ```

2. 開発サーバーの起動 (Express API Server + Vite):
   ```bash
   npm run dev
   ```

3. ブラウザでアクセス:
   - [http://localhost:5173/](http://localhost:5173/)

## フォルダ構成

```
sp500-erp-dashboard/
├── package.json          # 依存関係
├── vite.config.js        # Viteリバースプロキシ設定 (3001番ポートへ)
├── server/
│   ├── index.js          # Expressサーバー (キャッシュ管理 / エンドポイント)
│   └── dataProcessor.js  # Shillerデータ(Excel) & Yahoo Finance APIデータ統合
├── index.html            # メインHTML
└── src/
    ├── style.css         # スタイリング (ダークテーマ)
    ├── main.js           # UI制御 / API通信
    └── charts.js         # Plotly.jsチャート生成
```

## ライセンス

MIT License

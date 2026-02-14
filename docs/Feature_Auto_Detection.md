# 自動辞書判別機能 (Auto-Detect Dictionary Format)

v0.1.1 で導入された「自動判別機能」は、データの内容を分析し、最もトークン効率と安全性のバランスが良い辞書形式（Pure CSV または Hybrid JSON）を自動的に選択します。

## 概要

`encode` や `dumps` 関数において、`dictionaryFormat` オプションのデフォルト値は `"auto"` です。
これにより、ユーザーは辞書形式を意識することなく、データの特性に応じた最適なエンコーディングを利用できます。

```typescript
import { dumps } from "eton-ts";

const data = [...];
// 自動的に "csv" または "json" が選択される
const etonData = dumps(data, "Schema", schemas);
```

## 判別ロジック

エンコーダーは、入力データ配列の **最初の50行** をサンプリングし、以下のヒューリスティックに基づいて判定を行います。

### 1. Hybrid (JSON辞書) が選ばれる条件
以下のいずれかに該当する場合、ネスティング構造に強い **JSON形式** の辞書が選択されます。

*   **ネストされたオブジェクトが多い**:
    *   フィールド値としてオブジェクト（`{...}`）や配列が含まれる割合が、全フィールドの **20%** を超える場合。
    *   理由: Pure ETON (CSV) はネストされたデータを JSON 文字列化して CSV セルに埋め込むため、エスケープ処理（`""`）が増え、トークン数が増加する傾向があるため。

### 2. Pure (CSV辞書) が選ばれる条件 (デフォルト)
データが平坦（Tabular）である場合、トークン効率が最も高い **CSV形式** の辞書が選択されます。

*   値が主にプリミティブ型（文字列、数値、真偽値）で構成されている場合。
*   理由: CSV形式は引用符や括弧のオーバーヘッドが最小限であり、特に「テーブルデータ」において圧倒的な圧縮率（JSON比 -30%以上）を発揮するため。

## 手動指定

これまで通り、明示的に指定することも可能です。

```typescript
// 常に CSV 辞書を使用（Tabularデータなど）
const csvEton = dumps(data, "Schema", schemas, state, { dictionaryFormat: "csv" });

// 常に JSON 辞書を使用（複雑なGraphデータなど）
const jsonEton = dumps(data, "Schema", schemas, state, { dictionaryFormat: "json" });
```

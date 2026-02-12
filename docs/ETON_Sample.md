# ETON 形式サンプル

本サンプルは、ユーザー情報と商品注文情報を想定したETONの記述形式です。

## 1. ユーザー情報 (User Profile)

```csv
%Schema:User
id,name,email,role

%Symbol
"Alice",@1
"Admin",@2
"Bob",@3
"User",@4

%Data
1,@1,alice@example.com,@2
2,@3,bob@example.com,@4
```

## 2. 注文情報 (Order Details)

```csv
%Schema:Order
id,status,total,items

%Symbol
"Pending",@5
"Shipped",@6
"(item1;item2)",@7

%Data
ORD-101,@5,1500,@7
ORD-102,@6,3200,@_
```

## 3. 監査行 (Audit)

```csv
!AUDIT:4
```

---

### 解説
- **`%Schema`**: 各カラムの意味を定義。
- **`%Symbol`**: 頻出する定数をシンボル化。`Alice` や `Admin` 等が複数の場所で使われてもトークン消費は `@1` 程度に抑えられる。
- **`@_`**: Null または省略された値を示す。
- **`()`**: リスト形式（ネストデータ）。

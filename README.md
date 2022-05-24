# 日本語プログラミング言語「なでしこ3」

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)
[![npm version](https://badge.fury.io/js/nadesiko3core.svg)](https://www.npmjs.com/package/nadesiko3core)

## 「なでしこ3」とは

「なでしこ3」とは、日本語のプログラミング言語です。HTML5/JavaScript(TypeScript)をベースとしているので、PC/スマホ/タブレットなど、さまざまな環境で動作させることができます。日本語プログラミング言語は、読みやすく理解しやすいのが特徴で、初めてでも楽しくプログラミングを覚えることができます。

- [なでしこ3開発リポジトリ - nadesiko3](https://github.com/kujirahand/nadesiko3)
- [なでしこのWebサイト](https://nadesi.com/top/)

## 本リポジトリについて

本リポジトリは、なでしこ3の言語エンジンのみを取り出したものです。

# 使い方

例えば、`npm install nadesiko3core`でなでしこ3言語エンジンをインストールしたら、以下のプログラムを記述します。
例えば、`hoge.mjs`という名前で保存します。そして、以下のようなプログラムを記述します。

```js
import core from 'nadesiko3core'
const com = new core.NakoCompiler()
const g = com.run('1 + 2 * 3を表示') // ← ここになでしこのプログラム
console.log(g.log) // ← 「表示」した内容がlogに入っている
```

プログラムを実行するには、`node hoge.mjs`と記述すれば実行できます。

## コマンドラインからなでしこのプログラムを実行したい場合

なお、コマンドラインからなでしこのプログラムを実行したい場合には、[nadesiko3](https://github.com/kujirahand/nadesiko3)リポジトリを利用してください。
nadesiko3リポジトリには、コマンドライン版のなでしこが含まれています。



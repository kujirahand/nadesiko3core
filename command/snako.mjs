#!/usr/bin/env node
import fs from 'fs';
import com from '../index.mjs';
/** コマンドラインオプション */
class CommandOptions {
    constructor() {
        this.nodePath = '';
        this.scriptPath = '';
        this.filename = '';
        this.evalStr = '';
        this.isDebug = false;
    }
}
/** メイン処理 */
function main(argvOrg) {
    // コマンドラインオプションを確認
    const argv = [...argvOrg];
    const opt = new CommandOptions();
    opt.nodePath = argv.shift() || '';
    opt.scriptPath = argv.shift() || '';
    while (argv.length > 0) {
        const arg = argv.shift() || '';
        if (arg === '-d' || arg === '--debug') {
            opt.isDebug = true;
        }
        if (arg === '-e' || arg === '--eval') {
            opt.evalStr = argv.shift() || '';
            continue;
        }
        if (opt.filename === '') {
            opt.filename = arg;
        }
    }
    // -e オプションを実行したとき
    if (opt.evalStr) {
        evalStr(opt.evalStr);
        return;
    }
    // パラメータが空だったとき
    if (opt.filename === '') {
        showHelp();
        return;
    }
    // なでしこのコンパイラを生成
    const nako = new com.NakoCompiler();
    // logger を設定 --- リスナーを登録することでデバッグレベルを指定
    const logger = nako.getLogger();
    if (opt.isDebug) {
        logger.addListener('trace', (data) => {
            console.log(data.nodeConsole);
        });
    }
    logger.addListener('stdout', (data) => {
        console.log(data.noColor);
    });
    // ソースコードをファイルから読み込む
    const code = fs.readFileSync(opt.filename, 'utf-8');
    // 実行
    nako.run(code, opt.filename);
}
/** "-e" オプションでプログラムを直接実行する場合 */
function evalStr(src) {
    const nako = new com.NakoCompiler();
    const g = nako.run(src, 'main.nako3');
    console.log(g.log);
}
/** 使い方を表示 */
function showHelp() {
    console.log('●なでしこ(簡易版) # v.' + com.version.version);
    console.log('[使い方] node snako.mjs [--debug|-d] (filename)');
    console.log('[使い方] node snako.mjs [--eval|-e] (source)');
}
/** メイン処理を実行 */
main(process.argv);

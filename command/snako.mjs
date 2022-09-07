#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import com from '../index.mjs';
import * as url from 'url';
import { NakoGenOptions } from '../src/nako_gen.mjs';
import PluginSnako from './plugin_snako.mjs';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
/** コマンドラインオプション */
class CommandOptions {
    constructor() {
        this.nodePath = '';
        this.scriptPath = '';
        this.filename = '';
        this.evalStr = '';
        this.isDebug = false;
        this.flagConvert = false;
    }
}
/** メイン処理 */
async function main(argvOrg) {
    // コマンドラインオプションを確認
    const argv = [...argvOrg];
    const opt = new CommandOptions();
    opt.nodePath = argv.shift() || '';
    opt.scriptPath = argv.shift() || '';
    while (argv.length > 0) {
        const arg = argv.shift() || '';
        if (arg === '-d' || arg === '--debug') {
            opt.isDebug = true;
            continue;
        }
        if (arg === '-e' || arg === '--eval') {
            opt.evalStr = argv.shift() || '';
            continue;
        }
        if (arg === '-c' || arg === '--convert') {
            opt.flagConvert = true;
            continue;
        }
        if (opt.filename === '') {
            opt.filename = arg;
        }
    }
    // なでしこのコンパイラを生成
    const nako = new com.NakoCompiler();
    nako.addPluginObject('PluginSnako', PluginSnako);
    // 実行前にイベントを挟みたいとき
    nako.addListener('beforeRun', (g) => {
        g.__varslist[0]['ナデシコ種類'] = 'snako';
    });
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
    // -e オプションを実行したとき
    if (opt.evalStr) {
        await nako.runAsync(opt.evalStr, 'main.nako3');
        return;
    }
    // パラメータが空だったとき
    if (opt.filename === '') {
        showHelp();
        return;
    }
    // ソースコードをファイルから読み込む
    const code = fs.readFileSync(opt.filename, 'utf-8');
    // -c オプションが指定されたとき
    if (opt.flagConvert) {
        convert(nako, code, opt);
    }
    // 実行
    await nako.runAsync(code, opt.filename);
}
// -c オプションを指定したとき
function convert(nako, code, opt) {
    // オプションを指定
    const genOpt = new NakoGenOptions(false, ['nako_errors.mjs', 'nako_core_version.mjs', 'plugin_system.mjs'], 'self.__varslist[0][\'ナデシコ種類\'] = \'snako\'');
    // スタンドアロンコードを生成
    const js = nako.compileStandalone(code, opt.filename, genOpt);
    const jsFilename = opt.filename + '.js';
    fs.writeFileSync(jsFilename, js, { encoding: 'utf-8' });
    // 必要なライブラリをコピー
    const runtimeDir = path.join(path.dirname(jsFilename), 'nako3runtime');
    const srcDir = path.join(__dirname, '..', 'src');
    if (!fs.existsSync(runtimeDir)) {
        fs.mkdirSync(runtimeDir);
    }
    for (const f of genOpt.importFiles) {
        fs.copyFileSync(path.join(srcDir, f), path.join(runtimeDir, f));
    }
}
/** 使い方を表示 */
function showHelp() {
    console.log('●なでしこ(簡易版) # v.' + com.version.version);
    console.log('[使い方] node snako.mjs [--debug|-d] (filename)');
    console.log('[使い方] node snako.mjs [--eval|-e] (source)');
    console.log('[使い方] node snako.mjs [-c] (source) ... convert');
}
/** メイン処理を実行 */
main(process.argv);

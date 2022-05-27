import com from '../index.mjs';
import fs from 'fs';
import { NakoCompiler } from '../src/nako3.mjs';
class CommandOptions {
    constructor() {
        this.nodePath = '';
        this.scriptPath = '';
        this.filename = '';
        this.evalStr = '';
        this.isDebug = false;
    }
}
function showHelp() {
    console.log('●なでしこ # v.' + com.version.version);
    console.log('[使い方] node cnakoc.mjs [--debug|-d] (filename)');
    console.log('[使い方] node cnakoc.mjs [--eval|-e] (source)');
}
function main(argvOrg) {
    // check arguments
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
    if (opt.evalStr) {
        evalStr(opt.evalStr);
        return;
    }
    if (opt.filename === '') {
        showHelp();
        return;
    }
    // compiler
    const nako = new com.NakoCompiler();
    // set logger
    const logger = nako.getLogger();
    // set debug
    logger.addListener('trace', (data) => {
        if (opt.isDebug) {
            console.log(data.nodeConsole);
        }
    });
    // set stdout
    logger.addListener('stdout', (data) => {
        console.log(data.noColor);
    });
    // load
    const code = fs.readFileSync(opt.filename, 'utf-8');
    // run
    nako.run(code, opt.filename);
}
function evalStr(src) {
    const nako = new NakoCompiler();
    const g = nako.run(src, 'main.nako3');
    console.log(g.log);
}
main(process.argv);

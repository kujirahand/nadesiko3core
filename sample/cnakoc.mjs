import com from '../index.mjs';
import fs from 'fs';
class COptions {
    constructor() {
        this.nodePath = '';
        this.scriptPath = '';
        this.filename = '';
        this.isDebug = false;
    }
}
function main(argvOrg) {
    // check arguments
    const argv = argvOrg.join(':::').split(':::'); // clone
    const opt = new COptions();
    opt.nodePath = argv.shift() || '';
    opt.scriptPath = argv.shift() || '';
    while (argv.length > 0) {
        const arg = argv.shift() || '';
        if (arg === '-d' || arg === '--debug') {
            opt.isDebug = true;
        }
        if (opt.filename === '') {
            opt.filename = arg;
        }
    }
    // compiler
    const nako = new com.NakoCompiler();
    const logger = nako.getLogger();
    // set debug
    logger.addListener('debug', (data) => {
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
main(process.argv);

import core from '../index.mjs';
const com = new core.NakoCompiler();
const g = com.run('1 + 2 * 3を表示');
console.log(g.log);

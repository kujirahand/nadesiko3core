/**
 * なでしこ3 の TypeScript のための型定義
 */
export function NewEmptyToken(type = '?', value = {}, line = 0, file = 'main.nako3') {
    return {
        type,
        value,
        line,
        column: 0,
        file,
        josi: ''
    };
}
/**
 * コンパイルオプション
 */
export class CompilerOptions {
    constructor(initObj = {}) {
        this.testOnly = initObj.testOnly || false;
        this.resetEnv = initObj.resetEnv || false;
        this.resetAll = initObj.resetAll || false;
        this.preCode = initObj.preCode || '';
        this.nakoGlobal = initObj.nakoGlobal || null;
    }
}

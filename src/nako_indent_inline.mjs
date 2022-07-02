import { NewEmptyToken } from './nako_types.mjs';
/** インラインインデント構文 --- 末尾の":"をインデントを考慮して"ここまで"を挿入 (#1215) */
export function convertInlineIndent(tokens) {
    const lines = splitTokens(tokens, 'eol');
    const blockIndents = [];
    let checkICount = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length === 0) {
            continue;
        }
        // インデントの終了を確認する必要があるか？
        if (checkICount >= 0) {
            const lineICount = lines[i][0].indent;
            while (checkICount >= lineICount) {
                const tFirst = line[0];
                if (tFirst.type === '違えば' || (tFirst.type === 'word' && tFirst.value === 'エラー' && tFirst.josi === 'ならば')) {
                    // 挿入不要
                }
                else {
                    // ここまでを挿入する
                    lines[i - 1].push(NewEmptyToken('ここまで', '', lineICount, tFirst.line));
                }
                blockIndents.pop();
                if (blockIndents.length > 0) {
                    checkICount = blockIndents[blockIndents.length - 1];
                }
                else {
                    checkICount = -1;
                    break;
                }
            }
        }
        const tLast = getLastTokenWithoutEOL(line);
        if (tLast.type === ':') {
            // 末尾の「:」を削除
            lines[i] = lines[i].filter(t => t !== tLast);
            checkICount = tLast.indent;
            blockIndents.push(checkICount);
        }
    }
    if (lines.length > 0) {
        for (let i = 0; i < blockIndents.length; i++) {
            lines[lines.length - 1].push(NewEmptyToken('ここまで'));
        }
    }
    // 行ごとに分割していたトークンをくっつける
    const r = [];
    for (const line of lines) {
        for (const t of line) {
            r.push(t);
        }
        // console.log('@@debug=', line.map(t => (t.type+':'+t.indent)).join('|'))
    }
    return r;
}
function getLastTokenWithoutEOL(line) {
    const len = line.length;
    if (len === 0) {
        return NewEmptyToken('?');
    }
    let res = line[len - 1];
    if (res.type === 'eol') {
        if (len >= 2) {
            res = line[len - 2];
        }
    }
    return res;
}
function splitTokens(tokens, delimiter) {
    const result = [];
    let line = [];
    for (const t of tokens) {
        line.push(t);
        if (t.type === delimiter) {
            result.push(line);
            line = [];
        }
    }
    if (line.length > 0) {
        result.push(line);
    }
    return result;
}

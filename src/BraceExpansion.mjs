//! # Credits
//! Heavly based on https://github.com/juliangruber/brace-expansion

import * as List from "./List.mjs";
import * as Str from "./Str.mjs";

export {expand};

const ESC_SLASH = "\0SLASH_XXXXXXXXXXXXXXXXXXXX\0";
const ESC_OPEN = "\0OPEN_XXXXXXXXXXXXXXXXXXXX\0";
const ESC_CLOSE = "\0CLOSE_XXXXXXXXXXXXXXXXXXXX\0";
const ESC_COMMA = "\0COMMA_XXXXXXXXXXXXXXXXXXXX\0";
const ESC_PERIOD = "\0PERIOD_XXXXXXXXXXXXXXXXXXXX\0";

function expand(str) {
    if (!str) {
        return [];
    }

    let str2 = str;

    if (Str.begins(str2, "{}")) {
        str2 = "\\{\\}" + str2.substr(2);
    }

    return List.map(internalExpand(escapeBraces(str2), true), unescapeBraces);
}


// Internals

function internalExpand(str, isTop) {
    const m = Str.matchp(str, "{", "}");

    if (!m || /\$$/.test(m.pre)) {
        return [str];
    }

    const isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
    const isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
    const isSequence = isNumericSequence || isAlphaSequence;
    const isOptions = m.body.indexOf(",") >= 0;

    if (!isSequence && !isOptions) {
        if (m.post.match(/,.*\}/)) {
            const str2 = `{${m.body}${ESC_CLOSE}${m.post}`;
            return internalExpand(str2);
        }

        return [str];
    }

    let n;

    if (isSequence) {
        n = m.body.split(/\.\./);
    } else {
        n = parseCommaParts(m.body);

        if (n.length === 1) {
            // x{{a,b}}y ==> x{a}y x{b}y
            n = List.map(internalExpand(n[0], false), s => `{${s}}`);

            if (n.length === 1) {
                const post = m.post.length ? internalExpand(m.post, false) : [""];

                return List.map(post, p => `${m.pre}${n[0]}${p}`);
            }
        }
    }

    // at this point, n is the parts, and we know it"s not a comma set
    // with a single entry.

    // no need to expand pre, since it is guaranteed to be free of brace-sets
    const pre = m.pre;
    const post = m.post.length ? internalExpand(m.post, false) : [""];

    let N;

    if (isSequence) {
        const x = numeric(n[0]);
        const y = numeric(n[1]);

        let incr = n.length == 3 ? Math.abs(numeric(n[2])) : 1;
        let test = lte;

        if (y < x) {
            incr *= -1;
            test = gte;
        }

        const pad = List.some(n, el => /^-?0\d/.test(el));
        const width = Math.max(n[0].length, n[1].length)

        N = [];

        for (let i = x; test(i, y); i += incr) {
            let c;

            if (isAlphaSequence) {
                c = String.fromCharCode(i);

                if (c === "\\") {
                    c = "";
                }
            } else {
                c = String(i);

                if (pad) {
                    const need = width - c.length;

                    if (need > 0) {
                        const z = new Array(need + 1).join("0");

                        if (i < 0) {
                            c = `-${z}${c.slice(1)}`;
                        } else {
                            c = z + c;
                        }
                    }
                }
            }

            N.push(c);
        }
    } else {
        N = List.concatMap(n, e => internalExpand(e, false));
    }

    let result = [];


    for (let j = 0; j < N.length; j++) {
        for (let k = 0; k < post.length; k++) {
            const expansion = `${pre}${N[j]}${post[k]}`;

            if (!isTop || isSequence || expansion) {
                result = List.append(result, expansion);
            }
        }
    }

    return result;
}

function unescapeBraces(str) {
    return str.split(ESC_SLASH).join("\\")
              .split(ESC_OPEN).join("{")
              .split(ESC_CLOSE).join("}")
              .split(ESC_COMMA).join(",")
              .split(ESC_PERIOD).join(".");
}

function escapeBraces(str) {
    return str.split("\\\\").join(ESC_SLASH)
              .split("\\{").join(ESC_OPEN)
              .split("\\}").join(ESC_CLOSE)
              .split("\\,").join(ESC_COMMA)
              .split("\\.").join(ESC_PERIOD);
}

function lte(i, y) {
    return i <= y;
}

function gte(i, y) {
    return i >= y;
}

function numeric(str) {
    return parseInt(str, 10) == str ? parseInt(str, 10) : str.charCodeAt(0);
}

function parseCommaParts(str) {
    if (!str) {
        return [""];
    }

    const parts = [];
    const m = Str.matchp(str, "{", "}");

    if (!m) {
        return str.split(",");
    }


    var pre = m.pre;
    var body = m.body;
    var post = m.post;

    const p = pre.split(",");

    p[p.length - 1] += `{${body}}`;

    const postParts = parseCommaParts(post);

    if (post.length) {
        p[p.length - 1] += postParts.shift();
        p.push.apply(p, postParts);
    }

    parts.push.apply(parts, p);

    return parts;
}

//! Glob
//!
//! Based on minimatch by Isaac
//!
import * as List from "./List.mjs";
import * as Str from "./Str.mjs";

import * as BraceExpansion from "./BraceExpansion.mjs";

const QMARK = "[^/]";
const STAR = "[^/]*?";

const globStar = {};

export {create};
export {process};
export {match};
export {isGlobStar};

function create(matchPattern, options={}) {
    if (typeof matchPattern !== "string") {
        throw new TypeError("glob pattern string required");
    }

    const trimmedPattern = Str.trim(matchPattern);

    const {negate, pattern} = parseNegate(trimmedPattern, options);

    let globset = braceExpand(pattern, options);

    globset = List.map(globset, s => s.split(/\/+/));
    globset = List.map(globset, l => List.map(l, p => parse(p, false, options)));
    globset = List.filter(globset, s => s.indexOf(false) === -1);

    return { pattern, globset, negate, options };
}

function process(glob, files) {
    const {pattern, negate, globset, options} = glob;

    if (pattern === "") {
        return List.filter(files, f => f === "");
    }

    if(!options.nocomment && pattern[0] ===" #") {
        return [];
    }

    const result = List.filter(files, f => test(f, negate, globset, options));

    if (options.nonull && List.empty(result)) {
        return [pattern];
    }

    return result;
}

function match(pattern, files, options={}) {
    const glob = create(pattern, options);
    return process(glob, files);
}

function isGlobStar(obj) {
    return obj === globStar;
}

// Internals

function globUnescape(s) {
    return s.replace(/\\(.)/g, '$1');
}

function parseNegate(pattern, options) {
    if (options.nonegate) {
        return {negate: false, pattern};
    }

    let offset = 0;
    let negate = false;

    for (let i = 0, l = pattern.length; i < l && pattern.charAt(i) === '!'; i++) {
        negate = !negate;
        offset++;
    }

    if (offset) {
        return {negate, pattern: pattern.substr(offset)};
    }

    return {negate, pattern};
}

function braceExpand(pattern, options={}) {
    if (typeof pattern === void(0)) {
        throw new TypeError('undefined pattern')
    }

    if (options.nobrace || !pattern.match(/\{.*\}/)) {
        return [pattern];
    }

    return BraceExpansion.expand(pattern);
}

function test(file, negate, globset, options) {

    // TODO: add windows support
    // windows: need to use /, not \
    // if (path.sep !== '/') {
    //   f = f.split(path.sep).join('/')
    // }

    const parts = file.split(/\/+/);

    let filename;

    for (let i = parts.length - 1; i >= 0; i--) {
        filename = parts[i];

        if (filename) {
            break;
        }
    }

    for (let i = 0; i < globset.length; i++) {
        const pattern = globset[i];
        const p = options.matchBase && pattern.length === 1 ? [filename] : parts;

        if (matchOne(p, pattern, null, options)) {
            if (options.flipNegate) {
                return true;
            }

            return !negate;
        }
    }

    if (options.flipNegate) {
        return false;
    }

    return negate;
}

function matchOne(file, pattern, partial, options) {
    const fileLen = List.len(file);
    const patternLen = pattern.length;

    let fi = 0, pi = 0;

    for (; (fi < fileLen) && (pi < patternLen); fi++, pi++) {
        const p = pattern[pi]
        const f = file[fi]

        if (p === false) {
            return false;
        }

        if (p === globStar) {
            let fr = fi;
            let pr = pi + 1;

            if (pr === patternLen) {
                for (; fi < fileLen; fi++) {
                    if (file[fi] === "." || file[fi] === ".." ||
                        (!options.dot && file[fi].charAt(0) === ".")) {
                        return false;
                    }
                }

                return true;
            }

            while (fr < fileLen) {
                const swallowee = file[fr];

                if (matchOne(file.slice(fr), pattern.slice(pr), partial, options)) {
                    return true;
                } else {
                    if (swallowee === '.' ||
                        swallowee === '..' ||
                        (!options.dot && swallowee.charAt(0) === '.')) {
                        break;
                    }

                    fr++;
                }
            }

            if (partial) {
                if (fr === fileLen) {
                    return true;
                }
            }

            return false;
        }

        let hit;

        if (typeof p === "string") {
            if (options.nocase) {
                hit = Str.lower(f) === Str.lower(p);
            } else {
                hit = f === p;
            }
        } else {
            hit = f.match(p);
        }

        if (!hit) {
            return false;
        }
    }

    if (fi === fileLen && pi === patternLen) {
        return true;
    } else if (fi === fileLen) {
        return partial;
    } else if (pi === patternLen) {
        return (fi === patternLen - 1) && (file[fi] === "");
    }

    throw new Error('wtf?');
}

function clearStateChar(ch, inre, inmagic) {
    let re = inre;
    let hasMagic = inmagic;

    switch (ch) {
    default:
        re += '\\' + ch;
        break;

    case "*":
        re += STAR;
        hasMagic = true;
        break;

    case "?":
        re += QMARK;
        hasMagic = true;
        break;
    }

    return {re, hasMagic};
}

function parse(pattern, isSub, options) {
    if (pattern.length > 1024 * 64) {
        throw new TypeError("pattern is too long");
    }

    if (!options.noglobstar && pattern === "**") {
        return globStar;
    }

    if (pattern === "") {
        return "";
    }

    // ? => one single character
    const patternListStack = [];
    const negativeLists = [];

    let hasMagic = !!options.nocase;
    let escaping = false;
    let inClass = false;
    let reClassStart = -1;
    let classStart = -1;
    // . and .. never match anything that doesn't start with .,
    // even when options.dot is set.

    let re = "";
    let stateChar = null;

    let patternStart = "";

    if (pattern[0] === ".") {
        if (options.dot) {
            patternStart = "(?!(?:^|\\\/)\\.{1,2}(?:$|\\\/))";
        } else {
            patternStart = "(?!\\.)";
        }
    }

    const len = pattern.length;

    for (let i = 0, c; (i < len) && (c = pattern[i]); i++) {

        // skip over any that are escaped.
        if (escaping && isReSpecial(c)) {
            re += "\\" + c;
            escaping = false;
            continue;
        }

        switch (c) {
        default:
            if (stateChar) {
                ({re, hasMagic} = clearStateChar(stateChar, re, hasMagic));
                stateChar = null;
            }

            if (escaping) {
                escaping = false
            } else if (isReSpecial(c) && !(c === '^' && inClass)) {
                re += '\\'
            }

            re += c;
            break;

        case "/":
            // completely not allowed, even escaped.
            // Should already be path-split by now.
            return false;

        case "\\":
            if (stateChar) {
                ({re, hasMagic} = clearStateChar(stateChar, re, hasMagic));
                stateChar = null;
            }
            escaping = true;
            continue;

        // the various stateChar values
        // for the "extglob" stuff.
        case '?':
        case '*':
        case '+':
        case '@':
        case '!':
            if (inClass) {
                if (c === '!' && i === classStart + 1) {
                    c = '^';
                }
                re += c;
                continue;
            }

            if (stateChar) {
                ({re, hasMagic} = clearStateChar(stateChar, re, hasMagic));
                stateChar = null;
            }

            stateChar = c;

            // if extglob is disabled, then +(asdf|foo) isn't a thing.
            // just clear the statechar *now*, rather than even diving into
            // the patternList stuff.
            if (options.noext) {
                if (stateChar) {
                    ({re, hasMagic} = clearStateChar(stateChar, re, hasMagic));
                    stateChar = null;
                }
            }
            continue;

        case '(':
            if (inClass) {
                re += '(';
                continue;
            }

            if (!stateChar) {
                re += '\\(';
                continue;
            }

            patternListStack.push({
                type: stateChar,
                start: i - 1,
                reStart: re.length,
                open: plOpenExpression(stateChar),
                close: plCloseExpression(stateChar),
            });

            // negation is (?:(?!js)[^/]*)
            re += stateChar === '!' ? '(?:(?!(?:' : '(?:';
            stateChar = false;
            continue;

        case ')':
            if (inClass || !patternListStack.length) {
                re += '\\)';
                continue;
            }

            if (stateChar) {
                ({re, hasMagic} = clearStateChar(stateChar, re, hasMagic));
                stateChar = null;
            }

            hasMagic = true
            const pl = patternListStack.pop();
            // negation is (?:(?!js)[^/]*)
            // The others are (?:<pattern>)<type>
            re += pl.close;

            if (pl.type === '!') {
                negativeLists.push(pl);
            }

            pl.reEnd = re.length;
            continue;

        case '|':
            if (inClass || !patternListStack.length || escaping) {
                re += '\\|';
                escaping = false;
                continue;
            }

            if (stateChar) {
                ({re, hasMagic} = clearStateChar(stateChar, re, hasMagic));
                stateChar = null;
            }

            re += '|';
            continue;

            // these are mostly the same in regexp and glob
        case '[':
            if (stateChar) {
                ({re, hasMagic} = clearStateChar(stateChar, re, hasMagic));
                stateChar = null;
            }

            if (inClass) {
                re += '\\' + c;
                continue;
            }

            inClass = true;
            classStart = i;
            reClassStart = re.length;
            re += c;
            continue;

        case ']':
            if (i === classStart + 1 || !inClass) {
                re += '\\' + c;
                escaping = false;
                continue;
            }

            if (inClass) {
                const cs = pattern.substring(classStart + 1, i)
                try {
                    RegExp('[' + cs + ']')
                } catch (er) {
                    // not a valid class!
                    const sp = parse(cs, true, options);
                    re = re.substr(0, reClassStart) + '\\[' + sp[0] + '\\]';
                    hasMagic = hasMagic || sp[1];
                    inClass = false;
                    continue;
                }
            }

            // finish up the class.
            hasMagic = true;
            inClass = false;
            re += c;
            continue;

        }
    }

    if (inClass) {
        const cs = pattern.substr(classStart + 1);
        const sp = parse(cs, true, options);
        re = re.substr(0, reClassStart) + '\\[' + sp[0];
        hasMagic = hasMagic || sp[1];
    }

    for (let pl = patternListStack.pop(); pl; pl = patternListStack.pop()) {
        var tail = re.slice(pl.reStart + pl.open.length);
        tail = tail.replace(/((?:\\{2}){0,64})(\\?)\|/g, (_, $1, $2) => {
            if (!$2) {
                $2 = '\\';
            }

            return $1 + $1 + $2 + '|';
        });


        var t = pl.type === '*' ? STAR : pl.type === '?' ? QMARK : '\\' + pl.type;
        hasMagic = true;
        re = re.slice(0, pl.reStart) + t + '\\(' + tail;
    }

    if (stateChar) {
        ({re, hasMagic} = clearStateChar(stateChar, re, hasMagic));
        stateChar = null;
    }

    if (escaping) {
        re += '\\\\';
    }

    let addPatternStart = false;

    switch (re[0]) {
    case '.':
    case '[':
    case '(':
        addPatternStart = true;
    }

    for (let n = negativeLists.length - 1; n > -1; n--) {
        const nl = negativeLists[n]

        let nlBefore = re.slice(0, nl.reStart);
        let nlFirst = re.slice(nl.reStart, nl.reEnd - 8);
        let nlLast = re.slice(nl.reEnd - 8, nl.reEnd);
        let nlAfter = re.slice(nl.reEnd);

        nlLast += nlAfter;

        const openParensBefore = nlBefore.split('(').length - 1
        let cleanAfter = nlAfter;

        for (let i = 0; i < openParensBefore; i++) {
            cleanAfter = cleanAfter.replace(/\)[+*?]?/, '')
        }

        nlAfter = cleanAfter;

        let dollar = '';

        if (nlAfter === '' && isSub === false) {
            dollar = '$'
        }

        re = `${nlBefore}${nlFirst}${nlAfter}${dollar}${nlLast}`;
    }

    if (re !== '' && hasMagic) {
        re = '(?=.)' + re;
    }

    if (addPatternStart) {
        re = patternStart + re;
    }

    if (isSub === true) {
        return [re, hasMagic];
    }

    if (!hasMagic) {
        return globUnescape(pattern);
    }

    var flags = options.nocase ? 'i' : ''

    try {
        var regExp = new RegExp('^' + re + '$', flags);
    } catch (er) {
        return new RegExp('$.');
    }

    regExp._glob = pattern;
    regExp._src = re;

    return regExp;
}

function plOpenExpression(ch) {
    switch (ch) {
    case "!":
        return "(?:(?!(?:";

    case "?":
    case "+":
    case "*":
    case "@":
        return "(?:";
    }
}

function plCloseExpression(ch) {
    switch (ch) {
    case "!":
        return "))[^/]*?)";

    case "?":
        return ")?";

    case "+":
        return ")+";

    case "*":
        return ")*";

    case "@":
        return ")";
    }
}

function isReSpecial(ch) {
    switch (ch) {
    default:
        return false;

    case "(":
    case ")":
    case ".":
    case "*":
    case "{":
    case "}":
    case "+":
    case "?":
    case "[":
    case "]":
    case "^":
    case "$":
    case "\\":
    case "1":
        return true;
    }
}

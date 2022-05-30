import * as List from "./List.mjs";
import * as Str from "./Str.mjs";

export {parse};
export {help};

const TYPE_ANY          = 0x01;
const TYPE_ARGUMENT     = 0x02;
const TYPE_COMMAND      = 0x03;
const TYPE_EITHER       = 0x04;
const TYPE_ONEORMORE    = 0x05;
const TYPE_OPTION       = 0x06
const TYPE_OPTIONAL     = 0x07;
const TYPE_REQUIRED     = 0x08;

const NAME_ANY          = "ANY";
const NAME_ARGUMENT     = "ARGUMENT";
const NAME_COMMAND      = "COMMAND";
const NAME_EITHER       = "EITHER";
const NAME_ONEORMORE    = "ONEORMORE";
const NAME_OPTION       = "OPTION";
const NAME_OPTIONAL     = "OPTIONAL";
const NAME_REQUIRED     = "REQUIRED";

class Pattern {
    constructor() {
        this.type = 0;
        this.name = null;
        this.value = null;
        this.children = null;
        this.short = null;
        this.long = null;
        this.argcount = 0;
        this.value = false;
    }
}

/// Parse `argv` based on command-line interface described in `doc`.
///
/// `parse` creates your command-line interface based on its description
/// that you pass as `doc`. Such description can contain
/// --options, <positional-argument>, commands, which could be
/// [optional], (required), (mutually | exclusive) or repeated...
/// # Parameters
///
/// doc : str
///     Description of your command-line interface.
/// argv : list of str, optional
///     Argument vector to be parsed. sys.argv[1:] is used if not
///     provided.
/// help : bool (default: True)
///     Set to False to disable automatic help on -h or --help
///     options.
/// version : any object
///     If passed, the object will be printed if --version is in
///     `argv`.
/// options_first : bool (default: False)
///     Set to True to require options precede positional arguments,
///     i.e. to forbid options and positional arguments intermix.
/// # Returns
///
/// args : dict
///     A dictionary, where keys are names of command-line elements
///     such as e.g. "--verbose" and "<path>", and values are the
///     parsed values of those elements.
/// # Example
///
/// ```
/// import {Docopt} from "//es.parts/docopt/0.0.1/";
///
/// const doc = `
///     Usage:
///         my_program tcp <host> <port> [--timeout=<seconds>]
///         my_program serial <port> [--baud=<n>] [--timeout=<seconds>]
///         my_program (-h | --help | --version)
///
///     Options:
///         -h, --help  Show this screen and exit.
///         --baud=<n>  Baudrate [default: 9600]
/// `;
/// >>> argv = ['tcp', '127.0.0.1', '80', '--timeout', '30']
/// >>> docopt(doc, argv)
/// {'--baud': '9600',
///  '--help': False,
///  '--timeout': '30',
///  '--version': False,
///  '<host>': '127.0.0.1',
///  '<port>': '80',
///  'serial': False,
///  'tcp': True}
function parse(doc, argv, version=null, help=true, optionsFirst=false) {
    const usage = parseUsage(doc);
    const options = parseOptions(doc);
    const pattern = parsePattern(parseFormalUsage(usage), options);
    const args = parseArgs(argv, options);

    fixIdentities(pattern);
    fixListArguments(pattern);

    const [matched, left, collected] = match(pattern, args);

    if (matched === false || List.len(left)) {
        throw new Error("Parser error " + matched);
    }

    const poptions = List.filter(args, p => p.type === TYPE_OPTION);
    const pargs = List.filter(flat(pattern), isArgumentOrCommand);
    const combined = List.merge(options, poptions, pargs, collected);

    return List.foldl(combined, {}, (r, p) => {
        r[p.name] = p.value;
        return r;
    });
}

function help(doc) {
    return doc.replace(/^\s*|\s*$/, "");
}

// Internals

function createArgument(name, value=null) {
    const pattern = new Pattern;
    pattern.type = TYPE_ARGUMENT;
    pattern.name = name;
    pattern.value = value;
    return pattern;
}

function createCommand(name, value=false) {
    const pattern = new Pattern;
    pattern.type = TYPE_COMMAND;
    pattern.name = name;
    pattern.value = value;
    return pattern;
}

function createOption(short, long, argcount, value) {
    const pattern = new Pattern;
    pattern.type = TYPE_OPTION;
    pattern.name = long || short;
    pattern.short = short || null;
    pattern.long = long || null;
    pattern.argcount = argcount || 0;
    pattern.value = value || false;
    return pattern;
}

function createPatternWithChildren(type, children) {
    const pattern = new Pattern;
    pattern.type = type;
    pattern.children = children;
    return pattern;
}

function createRequired(children) {
    return createPatternWithChildren(TYPE_REQUIRED, children);
}

function createEither(children) {
    return createPatternWithChildren(TYPE_EITHER, children);
}

function createAny() {
    return createPatternWithChildren(TYPE_ANY, []);
}

function createOptional(children) {
    return createPatternWithChildren(TYPE_OPTIONAL, children);
}

function createOneOrMore(children) {
    return createPatternWithChildren(TYPE_ONEORMORE, children);
}

function createStream(source) {
    let tokens;

    if (typeof source === "string") {
        tokens = source.replace(/^\s+|\s+$/, '').split(/\s+/);
    } else {
        tokens = source;
    }

    return { tokens, idx: 0 };
}

function peek(stream) {
    return stream.tokens[stream.idx] || null;
}

function eof(stream) {
    return stream.idx === stream.tokens.length;
}

function next(stream) {
    return eof(stream) ? null : stream.tokens[stream.idx++];
}

function findSection(doc, name) {
    const rows = doc.split("\n");
    const initial = findRow(rows, name);

    if (initial === -1) {
        return [];
    }

    const result = [];

    for (let i = initial; i < rows.length; i++) {
        const row = Str.strip(rows[i]);

        if (row.length === 0 || (i !== initial && /\w:/.test(row))) {
            break;
        }

        result.push(row);
    }

    return result;
}

function findRow(rows, name) {
    const re = new RegExp(name, "i");

    for (let i = 0; i < rows.length; i++) {
        if (re.test(rows[i])) {
            return i;
        }
    }

    return -1;
}

function parseUsage(doc) {
    const section = findSection(doc, "usage:");

    if (List.empty(section)) {
        throw new SyntaxError(`"usage:" (case-insensitive) not found.`);
    }

    return section.join('\n').split(/\n\s*\n/)[0].replace(/^\s+|\s+$/, "");
}

function parseFormalUsage(usage) {
    const [_, usage2] = usage.split(":");
    const pu = usage2.split(/\s+/).slice(1);

    return Str.join(List.map(pu.slice(1), s => s === pu[0] ? "|" : s), " ");
}

function parseOptions(doc) {
    var s, _i, _len, _ref, _results;
    _ref = doc.split(/^\s*-|\n\s*-|options:\s*-/i).slice(1);
    _results = [];

    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      s = _ref[_i];
      _results.push(parseOption('-' + s));
    }
    return _results;
}

function parseOption(indesc) {
    const match = indesc.replace(/^\s*|\s*$/g, "").match(/(.*?)  (.*)/);

    let opts, desc;

    if (match) {
        opts = match[1]
        desc = match[2];
    } else {
        opts = indesc;
        desc = "";
    }

    const [splitted, _] = Str.strip(opts).split("  ");
    const options = splitted.replace(/,|=/g, " ");

    let short = null;
    let long = null;
    let argcount = 0;
    let value = false;

    List.each(options.split(/\s+/),  s => {
        if (s[0] === "-" && s[1] === "-") {
            long = s;
        } else if (s[0] === "-") {
            short = s;
        } else {
            argcount = 1;
        }
    });

    if (argcount === 1) {
        const match = /\[default:\s+(.*)\]/.exec(desc);
        value = match ? match[1] : false;
    }

    return createOption(short, long, argcount, value);
}

function parsePattern(source, options) {
    const stream = createStream(source.replace(/([\[\]\(\)\|]|\.\.\.)/g, " $1 "));
    const result = parseExpr(stream, options);

    if (peek(stream) !== null) {
        throw new Error("unexpected ending: " + Str.join(stream, " "));
    }

    return createRequired(result);
}

function parseExpr(stream, options) {
    const seq = parseSeq(stream, options);

    if (peek(stream) !== "|") {
        return seq;
    }

    let result = List.len(seq) > 1 ? [createRequired(seq)] : seq;

    while (peek(stream) === "|") {
        next(stream);
        const seq1 = parseSeq(stream, options);
        result = List.merge(result, List.len(seq1) > 1 ? [createRequired(seq1)] : seq1);
    }

    if (List.len(result) > 1) {
        return [createEither(result)];
    }

    return result;
}

function parseSeq(stream, options) {
    let result = [];

    let ref;

    while ((ref = peek(stream)) && ref !== "]" && ref !== ")" && ref !== "|") {
        let atom = parseAtom(stream, options);

        if (peek(stream) === "...") {
            atom = [createOneOrMore(atom)];
            next(stream);
        }

        result = List.merge(result, atom);
    }

    return result;
}

function parseAtom(stream, options) {
    const token = peek(stream);

    let result;

    switch (true) {

    default:
        return [createCommand(next(stream))];

    case token === "(":
        next(stream);
        result = [createRequired(parseExpr(stream, options))];
        if (next(stream) !== ")") {
            throw new Error("Unmatched '('");
        }
        return result;

    case token === "[":
        next(stream);

        if (peek(stream) === "options") {
            result = [createOptional([createAny()])];
            next(stream);
        } else {
            result = [createOptional(parseExpr(stream, options))];
        }

        if (next(stream) !== "]") {
            throw new Error("Unmatched '['");
        }

        return result;

    case Str.begins(token, "--"):
        if (token === "--") {
            return [createCommand(next(stream))];
        }
        return parseLong(stream, options);

    case token[0] === "-" && token !== "-":
        return parseShorts(stream, options);

    case (Str.begins(token, "<") && Str.ends(token, ">"))
           || /^[^a-z]*[A-Z]+[^a-z]*$/.test(token):
        return [createArgument(next(stream))];

    }
}

function parseArgs(argv, options) {
    const stream = createStream(argv);

    let opts = [];
    let token

    while ((token = peek(stream))) {
        switch (true) {

        default:
            opts = List.merge(opts, [createArgument(null, next(stream))]);
            break;

        case token === "--":
            return List.merge(opts, streamToArguments(stream));

        case Str.begins(token, "--"):
            opts = List.merge(opts, parseLong(stream, options, true));
            break;

        case token[0] === "-" && token !== "-":
            opts = List.merge(opts, parseShorts(stream, options, true));
            break;
        }
    }

    return opts;
}

function parseShorts(stream, options, parsingArgs=false) {
    const parsed = [];

    let raw = next(stream).slice(1);
    let idx = 0;
    let value;

    while (idx < raw.length) {
        const opt = List.filter(options, o => o.short && o.short[1] === raw[idx]);

        if (List.len(opt) > 1) {
            throw new SyntaxError(`"${raw[idx]}" is specified ambigously ${List.len(opt)} times`);
        }

        if (List.len(opt) < 1) {
            if (parsingArgs) {
                throw new SyntaxError(`"${raw[idx]}" is not recognized`);
            }

            const option = createOption("-" + raw[idx], null);
            options.push(option);
            parsed.push(option);
            idx++;
            continue;
        }

        const o = opt[0];
        const option = createOption(o.short, o.long, o.argcount, o.value);

        idx++;

        if (option.argcount === 0) {
            value = true;
        } else {
            if (idx === raw.length) {
                if (peek(stream) === null) {
                    throw new Error(`-${option.short[0]} requires argument`);
                }
                raw = next(stream);
                idx = 0;
            }

            value = raw;
            raw = "";
            idx = 0;
        }

        option.value = value;
        parsed.push(option);
    }

    return parsed;
}

function parseLong(stream, options, parsingArgs=false) {
    const token = next(stream);
    const m = token.match(/(.*?)=(.*)/);

    const raw = m ? m[1] : token;
    let value = m ? m[2] || null : null;

    // const opt = List.filter(options, o =>
    //                 o.long && Str.left(o.long, raw.length) === raw);

    const opt = List.filter(options, o => {
        if (o.long) {
            return Str.begins(o.long, raw);
        }

        return false;
    });

    if (List.len(opt) > 1) {
        throw new SyntaxError(`"${raw}" is specified ambigously ${List.len(opt)} times`);
    }

    if (List.len(opt) < 1) {
        if (parsingArgs) {
            throw new SyntaxError(`"${raw}" is not recognized`);
        }

        const option = createOption(null, raw, +(!!value));
        options.push(option);
        return [option];
    }

    const o = opt[0];
    const option = createOption(o.short, o.long, o.argcount, o.value);

    if (option.argcount === 1) {
        if (value === null) {
            if (peek(stream) === null) {
                throw new Error(`"${option.name} requires argument"`);
            }
            value = next(stream);
        }
    } else if (value !== null) {
        throw new Error(`"${option.name} must not have an argument"`);
    }
    option.value = value || true;

    return [option];
}

function streamToArguments(stream) {
    const result = [];

    while (eof(stream) === false) {
        result.push(createArgument(null, next(stream)));
    }

    return result;
}

function flat(pattern) {
    if (pattern.children === null) {
        return [pattern];
    }

    return List.flatten(List.map(pattern.children, c => flat(c)));
}

function fixIdentities(pattern, uniq=null) {
    if (pattern.children === null) {
        return;
    }

    let uniques = uniq || {};

    if (uniq === null) {
        List.each(flat(pattern), ref => (uniques[str(ref)] = ref));
    }

    List.each(List.clone(pattern.children), (c, idx) => {
        if (c.children === null) {
            pattern.children[idx] = uniques[str(c)];
        } else {
            fixIdentities(c, uniques);
        }
    });
}

function fixListArguments(pattern) {
    const lists = List.map(pattern.children, p => either(p).children);

    List.each(lists, list => {
        const counts = {};

        List.each(list, (_, idx) => counts[idx] = (counts[idx] || 0) + 1);

        List.each(list, (p, idx) => {
            if (counts[idx] > 1 && p.type == TYPE_ARGUMENT) {
                p.value = [];
            }
        });
    });
}

function either(pattern) {
    if (pattern.children === null) {
        return createEither([createRequired([pattern])]);
    }

    let result = [];

    const groups = [[pattern]];

    while (List.empty(groups) === false) {
        const children = groups.shift();
        const zip = List.map(children, (c, i) => [c, i]);

        const indices = {};
        const types = {};

        List.each(zip, childAndIdx => {
            const [child, idx] = childAndIdx;
            const name = typeToName(child.type);

            if (name in types === false) {
                types[name] = [];
            }

            types[name] = List.append(types[name], child);

            const ident = str(child);

            if (ident in indices === false) {
                indices[ident] = idx;
            }
        });

        let obj;

        switch (true) {

        default:
            result = List.merge(result, children);
            break;

        case NAME_EITHER in types:
            obj = types[NAME_EITHER][0];
            children.splice(indices[str(obj)], 1);
            List.each(obj.children, c => groups.push(List.merge([c], children)));
            break;

        case NAME_REQUIRED in types:
            obj = types[NAME_REQUIRED][0];
            children.splice(indices[str(obj)], 1);
            groups.push(List.merge(obj.children, children));
            break;

        case NAME_OPTIONAL in types:
            obj = types[NAME_OPTIONAL][0];
            children.splice(indices[str(obj)], 1);
            groups.push(List.merge(obj.children, children));
            break;

        case NAME_ONEORMORE in types:
            obj = types[NAME_ONEORMORE][0];
            children.splice(indices[str(obj)], 1);
            groups.push(List.merge(obj.children, children));
            break;

        }
    }

    return createEither(List.map(result, c => createRequired(c)));
}

function match(pattern, left, collected=[]) {
    switch (pattern.type) {

    case TYPE_ANY:
        return matchAny(pattern, left, collected);

    case TYPE_ARGUMENT:
        return matchArgument(pattern, left, collected);

    case TYPE_COMMAND:
        return matchCommand(pattern, left, collected);

    case TYPE_EITHER:
        return matchEither(pattern, left, collected);

    case TYPE_ONEORMORE:
        return matchOneOrMore(pattern, left, collected);

    case TYPE_OPTION:
        return matchOption(pattern, left, collected);

    case TYPE_OPTIONAL:
        return matchOptional(pattern, left, collected);

    case TYPE_REQUIRED:
        return matchRequired(pattern, left, collected);

    }
}

function matchAny(_, left, collected) {
    const left2 = List.filter(left, p => p.type !== TYPE_OPTION);
    return [Str.join(left, ", ") === Str.join(left2, ", "), left2, collected];
}

function matchArgument(pattern, left, collected) {
    const args = List.filter(left, p => p.type === TYPE_ARGUMENT);

    if (List.empty(args)) {
        return [false, left, collected];
    }

    const newleft = List.filter(left, p => str(p) !== str(List.head(args)));

    if (pattern.value === null || Array.isArray(pattern.value) === false) {
        const list = List.merge(collected, [createArgument(pattern.name, List.head(args).value)]);
        return [true, newleft, list];
    }

    const samename = List.filter(collected, p =>
                        p.type === TYPE_ARGUMENT && p.name === pattern.name);

    if (List.len(samename)) {
        List.head(samename).value.push(List.head(args).value);
        return [true, newleft, collected];
    }

    const list = List.merge(collected, [createArgument(pattern.name, List.head(args).value)]);

    return [true, newleft, list];
}

function matchCommand(pattern, left, collected) {
    const args = List.filter(left, p => p.type === TYPE_ARGUMENT);

    if (List.empty(args) || List.head(args).value !== pattern.name) {
        return [false, left, collected];
    }

    const head = str(List.head(args));
    const left2 = List.filter(left, p => str(p) !== head);
    const collected2 = List.append(collected, createCommand(pattern.name, true));

    return [true, left2, collected2];
}

function matchEither(pattern, left, collected) {
    const outcomes = [];

    List.each(pattern.children, p => {
        const outcome = match(p, left, collected);

        if (outcome[0]) {
            outcomes.push(outcome);
        }
    });

    if (List.empty(outcomes)) {
        return [false, left, collected];
    }

    outcomes.sort(sortEitherOutcomes);

    return List.head(outcomes);
}

function matchOneOrMore(pattern, left, collected) {
    let left2 = left;
    let collected2 = collected;
    let oldleft = [];
    let matched = true;
    let times = 0;

    while (matched) {
        const result = match(pattern.children[0], left2, collected2);
        matched = result[0];
        left2 = result[1];
        collected2 = result[2];

        if (Str.join(oldleft, ", ") === Str.join(left2, ", ")) {
            break;
        }
        oldleft = left2;
    }

    if (times >= 1) {
        return [true, left2, collected2];
    }

    return [false, left, collected];
}

function matchOption(pattern, left, collected) {
    const left2 = List.filter(left, p => p.type !== TYPE_OPTION
                                      || pattern.short !== p.short
                                      || pattern.long !== p.long);
    const matched = Str.join(List.map(left, p => str(p)), ", ") !==
                    Str.join(List.map(left2, p => str(p)), ", ");

    return [matched, left2, collected];
}

function matchOptional(pattern, left, collected) {
    let matched;
    let left2 = left;
    let collected2 = collected;

    List.each(pattern.children, p => {
        [matched, left2, collected2] = match(p, left2, collected2);
    });

    return [true, left2, collected2];
}

function matchRequired(pattern, left, collected) {
    let matched;
    let left2 = left;
    let collected2 = collected;

    const failed = List.some(pattern.children, p => {
        [matched, left2, collected2] = match(p, left2, collected2);

        if (matched === false) {
            return true;
        }
    });

    return failed ? [false, left, collected] : [true, left2, collected2];
}

function sortEitherOutcomes(a, b) {
    if (a[1].length > b[1].length) {
        return 1;
    } else if (a[1].length < b[1].length) {
        return -1;
    } else {
        return 0;
    }
}

function isArgumentOrCommand(pattern) {
    return pattern.type === TYPE_ARGUMENT
        || pattern.type === TYPE_COMMAND;
}

function str(pattern) {
    switch(pattern.type) {

    default:
        const formals = Str.join(List.map(pattern.children, str), ", ");
        return `${typeToName(pattern.type)}(${formals})`;

    case TYPE_ARGUMENT:
        return `${NAME_ARGUMENT}(${pattern.name}, ${pattern.value})`;

    case TYPE_COMMAND:
        return `${NAME_COMMAND}(${pattern.name}, ${pattern.value})`;

    case TYPE_OPTION:
        return `${NAME_OPTION}(${pattern.short}, ${pattern.long}, ${pattern.argcount}, ${pattern.value})`;
    }
}

function typeToName(type) {
    switch(type) {
    case TYPE_OPTION:
        return NAME_OPTION;

    case TYPE_ONEORMORE:
        return NAME_ONEORMORE;

    case TYPE_OPTIONAL:
        return NAME_OPTIONAL;

    case TYPE_ANY:
        return NAME_ANY;

    case TYPE_EITHER:
        return NAME_EITHER;

    case TYPE_REQUIRED:
        return NAME_REQUIRED;

    case TYPE_COMMAND:
        return NAME_COMMAND;

    case TYPE_ARGUMENT:
        return NAME_ARGUMENT;
    }
}

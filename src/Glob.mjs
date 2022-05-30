import * as Fs from "fs";

import * as Dict from "./Dict.mjs";
import * as List from "./List.mjs";
import * as Path from "./Path.mjs";
import * as Str from "./Str.mjs";

import * as Pattern from "./Pattern.mjs";

export {find};

const MATCH_SEP = "/";

class PromiseState {
    constructor() {
        this.promise = null;
        this.resolve = null;
        this.reject = null;
    }
}

class FindState {
    constructor(cwd) {
        this.cwd = cwd;
        this.dotfiles = false;
        this.infocache = {};
        this.listcache = {};
    }
}

const notFoundInfo = {};
const foundInfo = {};
const findEmptyResult = {};


///
/// # Options
/// -  `cwd` working directory, defaults to `/`.
async function find(pattern, options={}) {
    const glob = Pattern.create(pattern, {nonegate: 1, nocomment: 1});
    const patterns = List.clone(glob.globset);

    const state = new FindState(options.cwd || MATCH_SEP);
    state.dotfiles = options.dotfiles || false;

    const promises = List.map(patterns, p => process(state, p));

    return Promise.all(promises)
        .then(results => {
            const merged = List.foldl(results, findEmptyResult, (a, o) => Dict.merge(a, o));
            return Dict.keys(merged);
        });
}

// Internals

function process(state, pattern, inglobstar=false) {
    let n = 0;

    while (typeof pattern[n] === "string") {
        n++;
    }

    // see if there's anything else
    let prefix;

    switch (n) {
    default:
        // pattern has some string bits in the front.
        // whatever it starts with, whether that's 'absolute' like /foo/bar,
        // or 'relative' like '../baz'
        prefix = pattern.slice(0, n).join(MATCH_SEP);
        break;

    case pattern.length:
        return processSimple(state, Str.join(pattern, MATCH_SEP));

    case 0:
        // pattern *starts* with some non-trivial item.
        // going to readdir(cwd), but not include the prefix in matches.
        prefix = null
        break;

    }

    const remain = pattern.slice(n);

    // get the list of entries.
    let read;

    if (prefix === null) {
        read = ".";
    } else if (Path.isAbsolute(prefix) || Path.isAbsolute(pattern.join('/'))) {
        if (!prefix || Path.isAbsolute(prefix) === false) {
            prefix = `${MATCH_SEP}${prefix}`;
        }
        read = prefix;
    } else {
        read = prefix;
    }

    const abspath = makeAbs(state.cwd, read);

    // TODO: Add support for ignore of some paths.

    if (Pattern.isGlobStar(remain[0])) {
        return listThen(state, remain, prefix, abspath, processGlobStar);
    }

    return listThen(state, remain, prefix, abspath, processList);
}

async function processSimple(state, prefix) {
    const result = await info(state, prefix);

    if (result === notFoundInfo) {
        return;
    }

    const needdir = Str.ends(prefix, MATCH_SEP);

    if (needdir === false || info.type === Fs.TYPE_DIR) {

    }
}

function processList(state, remain, prefix, path, files) {
    const pattern = remain[0];
    const dotfiles = pattern._glob[0] === "." || state.dotfiles;

    const matches = List.filter(files, file => {
        if (file[0] === "." && dotfiles === false) {
            return false;
        }

        return pattern.test(file);
    });

    if (List.len(matches) === 0) {
        return findEmptyResult;
    }

    if (remain.length === 1) {
        const resolved = List.map(matches, p => {
            let file;

            if (prefix) {
                if (prefix !== "/") {
                    file = `${prefix}/${p}`;
                } else {
                    file = `${prefix}${p}`;
                }
            } else {
                file = p;
            }

            if (file[0] === MATCH_SEP) {
                file = Path.join(state.cwd, file);
            }

            return file;
        });

        return List.foldl(resolved, findEmptyResult, (a, p) => {
            a[p] = 1;
            return a;
        });
    }

    remain.shift();
    const promises = List.map(matches, match => {
        let file;

        if (prefix) {
            if (prefix !== "/") {
                file = `${prefix}/${match}`;
            } else {
                file = `${prefix}${match}`;
            }
        } else {
            file = match;
        }

        return process(state, List.prepend(remain, file));
    });

    return Promise.all(promises)
        .then(results => List.foldl(results, findEmptyResult, (a, r) => Dict.merge(a, r)));
}

function processGlobStar(state, remain, prefix, path, files) {
    let promises = [];

    const remainWithoutGlobStar = remain.slice(1);
    const gspref = prefix ? [ prefix ] : [];

    const noGlobStar = List.merge(gspref, remainWithoutGlobStar);
    promises = List.prepend(promises, process(state, noGlobStar));

    // TODO: Check if in symlink and globstar, if so, exit here

    List.each(files, file => {
        if (file[0] === "." && state.dotfiles === false) {
            return;
        }

        const instead = List.merge(gspref, List.prepend(remainWithoutGlobStar, file));
        promises = List.prepend(promises, process(state, instead));

        const below = List.merge(gspref, List.prepend(remain, file));
        promises = List.prepend(promises, process(state, below));
    });

    return Promise.all(promises)
        .then(results => List.foldl(results, findEmptyResult, (a, r) => Dict.merge(a, r)));
}

async function listThen(state, remain, prefix, path, next) {
    const files = await list(state, path);

    if (files === null) {
        return findEmptyResult;
    }

    return next(state, remain, prefix, path, files);
}

async function list(state, path) {
    let liststate = state.listcache[path];

    if (liststate) {
        return liststate.promise;
    }

    liststate = makePromiseState();

    try {
        const files = await listFiles(path);

        List.each(files, p => {
            const abspath = findJoin(path, p);

            if (abspath in state.infocache === false) {
                state.infocache[abspath] = foundInfo;
            }
        });

        liststate.resolve(files);
        return files;
    } catch (error) {
        switch (error.code) {
        default:
            console.log(error);
            break;

        case "ENOTSUP":
        case "ENOTDIR":
            state.infocache[path] = foundInfo;
            break;

        case "ENOENT":
            state.infocache[path] = notFoundInfo;
            break;
        }
        liststate.resolve(null);
        return null;
    }
}

function info(state, path) {
    const abspath = makeAbs(state.cwd, path);

    let infostate = state.infocache[abspath];

    if (!infostate) {
        infostate = makePromiseState();

        state.infocache[abspath] = infostate;

        Fs.info(abspath)
            .then(info => {
                // TODO: Check if symbolic link exists or not
                infostate.resolve(info);
            })
            .catch(error => {
                infostate.resolve(notFoundInfo);
            });
    }

    return infostate.promise;

    const info = state.infocache[abspath];

    if (info) {

    }


    if (abspath in state.lookupCache) {
        return state.lookupCache[abspath];
    }

    state.lookupCache[abspath] = makePromise((resolve, reject) => {
        info(abspath)
            .then(info => {

            })
            .catch(error => {
                if (error.code === "ENOENT" ||
                    error.code === "ENOTDIR") {
                    state.infocache[abspath] = nonInfo;
                    return resolve(nonInfo);
                }


            })
    });

    return state.lookupCache[abspath];
}

function makeAbs(basepath, path) {
    let abs = path;

    if (path[0] === "/") {
        abs = Path.join(basepath, path);
    } else if (Path.isAbsolute(path) || path === "") {
        abs = path;
    } else {
        abs = Path.resolve(basepath, path);
    }

    // if (process.platform === 'win32')
    //   abs = abs.replace(/\\/g, '/')

    return abs;
}

function findJoin(basepath, path) {
    return basepath === "/" ? `/${path}` : `${basepath}/${path}`;
}

function makePromiseState() {
    const state = new PromiseState;

    state.promise = new Promise((resolve, reject) =>  {
        state.resolve = resolve;
        state.reject = reject;
    });

    return state;
}

function listFiles(path) {
    return new Promise((resolve, reject) => {
        Fs.readdir(path, (error, content) => {
            if (error) {
                return reject(error);
            }

            return resolve(content);
        });
    });
}

//! Functions for working with file and directory paths.
//! Based on path.js of Nodejs

export {normalizeArray};
export {splitPath};
export {resolve};
export {normalize};
export {isAbsolute};
export {join};
export {relative};
export {dirname};
export {basename};
export {extname};

const splitRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;

/// resolves . and .. elements in a path array with directory names there
/// must be no slashes, empty elements, or device names (c:\) in the array
/// (so also no leading and trailing slashes - it does not distinguish
/// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    let up = 0;

    for (let i = parts.length - 1; i >= 0; i--) {
        const last = parts[i];
        if (last === '.') {
            parts.splice(i, 1);
        } else if (last === '..') {
            parts.splice(i, 1);
            up++;
        } else if (up) {
            parts.splice(i, 1);
            up--;
        }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
        for (; up--; up) {
            parts.unshift('..');
        }
    }

    return parts;
}


/// Split a filename into [root, dir, basename, ext], unix version
/// 'root' is just a slash, or nothing.
function splitPath(filename) {
    return splitRe.exec(filename).slice(1);
}


function resolve(...args) {
    let resolvedPath = '';
    let resolvedAbsolute = false;

    for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
        let path = (i >= 0) ? args[i] : process.cwd();

        // Skip empty and invalid entries
        if (typeof path !== "string") {
            throw new TypeError('Arguments to path.resolve must be strings');
        } else if (!path) {
            continue;
        }

        resolvedPath = path + '/' + resolvedPath;
        resolvedAbsolute = path.charAt(0) === '/';
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeArray(resolvedPath.split('/').filter(function(p) {
        return !!p;
    }), !resolvedAbsolute).join('/');

    if (resolvedAbsolute) {
        return "/" + resolvedPath;
    }
    return resolvedPath;
    // return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
}


function normalize(path) {
    const absolute = isAbsolute(path);
    const trailingSlash = path[path.length - 1] === '/';
    const segments = path.split('/');
    const nonEmptySegments = [];

    // Normalize the path
    for (let i = 0; i < segments.length; i++) {
        if (segments[i]) {
            nonEmptySegments.push(segments[i]);
        }
    }
    path = normalizeArray(nonEmptySegments, !absolute).join('/');

    if (!path && !absolute) {
        path = '.';
    }
    if (path && trailingSlash) {
        path += '/';
    }

    return (absolute ? '/' : '') + path;
}


function isAbsolute(path) {
    return path.charAt(0) === '/';
}

function join(...args) {

    let path = '';

    for (let i = 0; i < args.length; i++) {
        let segment = args[i];

        if (typeof path !== "string") {
            throw new TypeError("Arguments to Path.join must be strings");
        }

        if (segment) {
            if (!path) {
                path += segment;
            } else {
                path += '/' + segment;
            }
        }
    }

    return normalize(path);
}


function relative(from, to) {
    const fromResolved = resolve(from).substr(1);
    const toResolved = resolve(to).substr(1);

    function trim(arr) {
        let start = 0;

        for (; start < arr.length; start++) {
            if (arr[start] !== '') break;
        }

        let end = arr.length - 1;
        for (; end >= 0; end--) {
            if (arr[end] !== '') break;
        }

        if (start > end) {
            return [];
        }

        return arr.slice(start, end + 1);
    }

    const fromParts = trim(fromResolved.split('/'));
    const toParts = trim(toResolved.split('/'));

    const length = Math.min(fromParts.length, toParts.length);
    let samePartsLength = length;

    for (let i = 0; i < length; i++) {
        if (fromParts[i] !== toParts[i]) {
            samePartsLength = i;
            break;
        }
    }

    let outputParts = [];

    for (let i = samePartsLength; i < fromParts.length; i++) {
        outputParts.push('..');
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength));

    return outputParts.join('/');
}


function dirname(path) {
    const result = splitPath(path);
    const root = result[0];

    let dir = result[1];

    if (!root && !dir) {
        // No dirname whatsoever
        return '.';
    }

    if (dir) {
        // It has a dirname, strip trailing slash
        dir = dir.substr(0, dir.length - 1);
    }

    return root + dir;
}


function basename(path, ext) {
    let f = splitPath(path)[2];

    if (ext && f.substr(-1 * ext.length) === ext) {
        f = f.substr(0, f.length - ext.length);
    }

    return f;
}


function extname(path) {
    return splitPath(path)[3];
}

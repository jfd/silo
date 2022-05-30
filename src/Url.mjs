//! Url
//!
//! Reference: RFC 3986, RFC 1808, RFC 2396
//!
//! Heavly based on Nodejs implementation.
//!
import * as Dict from "./Dict.mjs";
import * as List from "./List.mjs";
import * as Punycode from "./Punycode.mjs";
import * as QueryString from "./QueryString.mjs";

export {parse};
export {format};
export {resolve};

export class Url {
    constructor() {
        this.protocol = null;
        this.hashash = false;
        this.hassearch = false;
        this.slashes = false;
        this.auth = null;
        this.username = null;
        this.password = null;
        this.host = null;
        this.port = null;
        this.hostname = null;
        this.hash = null;
        this.search = null;
        this.query = null;
        this.pathname = null;
        this.path = null;
        this.href = null;
    }
}


const CHAR_HASHSIGN         = 35;
const CHAR_QUESTIONMARK     = 63;
const CHAR_SPACE            = 32;
const CHAR_TAB              = 9;
const CHAR_PERCENTAGE       = 37;
const CHAR_QUOTE            = 34;
const CHAR_COLON            = 58;
const CHAR_SLASH            = 47;
const CHAR_RETURN           = 13;
const CHAR_NEWLINE          = 10;
const CHAR_FEED             = 12;
const CHAR_SQUOTE           = 39;
const CHAR_BACKSLASH        = 92;
const CHAR_SEMICOLON        = 59;
const CHAR_DOT              = 46;
const CHAR_LT               = 60;
const CHAR_GT               = 62;
const CHAR_AT               = 64;
const CHAR_F                = 102;
const CHAR_I                = 105;
const CHAR_L                = 108;
const CHAR_E                = 101;
const CHAR_BRACKETL         = 91;
const CHAR_BRACKETR         = 93;

const hexTable = [
    "%00","%01","%02","%03","%04","%05","%06","%07",
    "%08","%09","%0A","%0B","%0C","%0D","%0E","%0F",
    "%10","%11","%12","%13","%14","%15","%16","%17",
    "%18","%19","%1A","%1B","%1C","%1D","%1E","%1F",
    "%20","%21","%22","%23","%24","%25","%26","%27",
    "%28","%29","%2A","%2B","%2C","%2D","%2E","%2F",
    "%30","%31","%32","%33","%34","%35","%36","%37",
    "%38","%39","%3A","%3B","%3C","%3D","%3E","%3F",
    "%40","%41","%42","%43","%44","%45","%46","%47",
    "%48","%49","%4A","%4B","%4C","%4D","%4E","%4F",
    "%50","%51","%52","%53","%54","%55","%56","%57",
    "%58","%59","%5A","%5B","%5C","%5D","%5E","%5F",
    "%60","%61","%62","%63","%64","%65","%66","%67",
    "%68","%69","%6A","%6B","%6C","%6D","%6E","%6F",
    "%70","%71","%72","%73","%74","%75","%76","%77",
    "%78","%79","%7A","%7B","%7C","%7D","%7E","%7F",
    "%80","%81","%82","%83","%84","%85","%86","%87",
    "%88","%89","%8A","%8B","%8C","%8D","%8E","%8F",
    "%90","%91","%92","%93","%94","%95","%96","%97",
    "%98","%99","%9A","%9B","%9C","%9D","%9E","%9F",
    "%A0","%A1","%A2","%A3","%A4","%A5","%A6","%A7",
    "%A8","%A9","%AA","%AB","%AC","%AD","%AE","%AF",
    "%B0","%B1","%B2","%B3","%B4","%B5","%B6","%B7",
    "%B8","%B9","%BA","%BB","%BC","%BD","%BE","%BF",
    "%C0","%C1","%C2","%C3","%C4","%C5","%C6","%C7",
    "%C8","%C9","%CA","%CB","%CC","%CD","%CE","%CF",
    "%D0","%D1","%D2","%D3","%D4","%D5","%D6","%D7",
    "%D8","%D9","%DA","%DB","%DC","%DD","%DE","%DF",
    "%E0","%E1","%E2","%E3","%E4","%E5","%E6","%E7",
    "%E8","%E9","%EA","%EB","%EC","%ED","%EE","%EF",
    "%F0","%F1","%F2","%F3","%F4","%F5","%F6","%F7",
    "%F8","%F9","%FA","%FB","%FC","%FD","%FE","%FF",
];

// define these here so at least they only have to be
// compiled once on the first module load.
const protocolPatternRe = /^([a-z0-9.+-]+:)/i;

// Special case for a simple path URL
const simplePathPatternRe = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/;

const hostnameMaxLen = 255;

// protocols that never have a hostname.
const hostlessProtocol = {
    "javascript": true,
    "javascript:": true
};

// protocols that always contain a // bit.
const slashedProtocol = {
    "http": true,
    "http:": true,
    "https": true,
    "https:": true,
    "ftp": true,
    "ftp:": true,
    "gopher": true,
    "gopher:": true,
    "ws": true,
    "ws:": true,
    "wss": true,
    "wss:": true,
    "file": true,
    "file:": true
};

function parse(str, slashesDenoteHost=false) {
    const url = new Url;

    let hasHash = false;
    let start = -1;
    let end = -1;
    let rest = "";
    let lastPos = 0;

    let split = false;

    let inWs;

    for (let i = 0; i < str.length; ++i) {
        const ch = str.charCodeAt(i);
        const isWs = isWhitespace(ch);

        if (start === -1) {
            if (isWs) {
                continue;
            }
            lastPos = start = i;
        } else {
            if (inWs) {
                if (!isWs) {
                    end = -1;
                    inWs = false;
                }
            } else if (isWs) {
                end = i;
                inWs = true;
            }
        }

        // Only convert backslashes while we haven"t seen a split character
        if (!split) {
            switch (ch) {
            case CHAR_HASHSIGN:
                hasHash = true;
            case CHAR_QUESTIONMARK:
                split = true;
                break;
            case CHAR_BACKSLASH:
                if (i - lastPos > 0) {
                    rest += str.slice(lastPos, i);
                }
                rest += "/";
                lastPos = i + 1;
                break;
            }
        } else if (!hasHash && ch === CHAR_HASHSIGN) {
            hasHash = true;
        }
    }

    // Check if string was non-empty (including strings with only whitespace)
    if (start !== -1) {
        if (lastPos === start) {
            // We didn"t convert any backslashes
            if (end === -1) {
                if (start === 0) {
                    rest = str;
                } else {
                    rest = str.slice(start);
                }
            } else {
                rest = str.slice(start, end);
            }
        } else if (end === -1 && lastPos < str.length) {
            // We converted some backslashes and have only part of the entire
            // string
            rest += str.slice(lastPos);
        } else if (end !== -1 && lastPos < end) {
            // We converted some backslashes and have only part of the entire
            // string
            rest += str.slice(lastPos, end);
        }
    }

    if (!slashesDenoteHost && !hasHash) {
        // Try fast path regexp
        const simple_path = simplePathPatternRe.exec(rest);

        if (simple_path) {
            url.path = rest;
            url.href = rest;
            url.pathname = simple_path[1];

            if (simple_path[2]) {
                url.search = simple_path[2];

            }

            return url;
        }
    }

    const protomatch = protocolPatternRe.exec(rest);

    let proto, lowerProto;

    if (protomatch) {
        proto = protomatch[0];

        lowerProto = proto.toLowerCase();
        url.protocol = lowerProto;
        rest = rest.slice(proto.length);
    }

    let slashes;

    // figure out if it"s got a host
    // user@server is *always* interpreted as a hostname, and url
    // resolution will treat //foo/bar as host=foo,path=bar because that"s
    // how the browser resolves relative URLs.

    if (slashesDenoteHost || proto || /^\/\/[^@\/]+@[^@\/]+/.test(rest)) {

        slashes = rest.charCodeAt(0) === CHAR_SLASH &&
                  rest.charCodeAt(1) === CHAR_SLASH;

        if (slashes && !(proto && hostlessProtocol[proto])) {
            rest = rest.slice(2);
            url.slashes = true;
        }
    }

    if ((slashes || isHostlessProtocol(proto) === false) &&
        (slashes || (proto && !slashedProtocol[proto]))) {

        let hostEnd = -1;
        let atSign = -1;
        let nonHost = -1;

        for (let i = 0; i < rest.length; ++i) {
            switch (rest.charCodeAt(i)) {

            // case CHAR_TAB:
            // case CHAR_NEWLINE:
            // case CHAR_RETURN:
            // case CHAR_SPACE:
            case CHAR_QUOTE:
            case CHAR_PERCENTAGE:
            case CHAR_SQUOTE:
            case CHAR_SEMICOLON:
            case CHAR_LT:
            case CHAR_GT:
            case CHAR_BACKSLASH:
            case 94:  // "^"
            case 96:  // "`"
            case 123: // "{"
            case 124: // "|"
            case 125: // "}"
                // Characters that are never ever allowed in a hostname from
                // RFC 2396
                if (nonHost === -1) {
                    nonHost = i;
                }
                break;

            case CHAR_HASHSIGN:
            case CHAR_SLASH:
            case CHAR_QUESTIONMARK:
                // Find the first instance of any host-ending characters
                if (nonHost === -1) {
                    nonHost = i;
                }
                hostEnd = i;
                break;

            case CHAR_AT:
                // At this point, either we have an explicit point where the
                // auth portion cannot go past, or the last @ char is the decider.
                atSign = i;
                nonHost = -1;
                break;
            }

            if (hostEnd !== -1) {
                break;
            }
        }

        start = 0;

        if (atSign !== -1) {
            setAuth(url, decodeURIComponent(rest.slice(0, atSign)));
            start = atSign + 1;
        }

        if (nonHost === -1) {
            url.host = trimWhitespaces(rest.slice(start));
            rest = "";
        } else {
            url.host = trimWhitespaces(rest.slice(start, nonHost));
            rest = rest.slice(nonHost);
        }

        parseHost(url);

        // we"ve indicated that there is a hostname,
        // so even if it"s empty, it has to be present.
        if (typeof url.hostname !== "string") {
            url.hostname = "";
        }

        const hostname = url.hostname;

        // if hostname begins with [ and ends with ]
        // assume that it"s an IPv6 address.
        const ipv6Hostname = hostname.charCodeAt(0) === CHAR_BRACKETL &&
                             hostname.charCodeAt(hostname.length - 1) === CHAR_BRACKETR;

        // validate a little.
        if (!ipv6Hostname) {
            const result = validateHostname(url, rest, hostname);

            if (result !== void(0)) {
                rest = result;
            }
        }

        if (url.hostname.length > hostnameMaxLen) {
            url.hostname = "";
        } else {
            // hostnames are always lower case.
            url.hostname = url.hostname.toLowerCase();
        }

        if (!ipv6Hostname) {
            // IDNA Support: Returns a punycoded representation of "domain".
            // It only converts parts of the domain name that
            // have non-ASCII characters, i.e. it doesn"t matter if
            // you call it with a domain that already is ASCII-only.
            url.hostname = Punycode.toASCII(url.hostname);
        }

        if (ipv6Hostname) {
            url.hostname = `[${parseIPv6Address(url.hostname.slice(1, -1))}]`;

            if (rest[0] !== "/") {
                rest = "/" + rest;
            }
        }

        const p = url.port ? ":" + url.port : "";
        const h = url.hostname || "";

        url.host = h + p;
    }

    // now rest is set to the post-host stuff.
    // chop off any delim chars.
    if (slashes || slashedProtocol[lowerProto]) {
        // First, make 100% sure that any "autoEscape" chars get
        // escaped, even if encodeURIComponent doesn"t think they
        // need to be.
        const result = autoEscapeStr(rest);

        if (rest.length === 0 && slashesDenoteHost === false) {
            throw new Error('Invalid protocol')
        }

        if (result !== void(0)) {
            rest = result;
        }
    } else {
        const ch = rest.charCodeAt(0);
        if (isWhitespace(ch) && ch !== 32) {
            rest = rest.slice(1);
        }
    }

    let questionIdx = -1;
    let hashIdx = -1;

    for (let i = 0; i < rest.length; i++) {
        const code = rest.charCodeAt(i);

        if (code === CHAR_HASHSIGN) {
            url.hashash = true;
            url.hash = i === rest.length - 1 ?
                         null : `#${escapeHash(decodeURIComponent(rest.slice(i + 1)))}`;
            hashIdx = i;
            break;
        } else if (code === CHAR_QUESTIONMARK && questionIdx === -1) {
            questionIdx = i;
        }
    }

    if (questionIdx !== -1) {
        if (hashIdx === -1) {
            url.search = rest.slice(questionIdx);
            url.query = rest.slice(questionIdx + 1);
        } else {
            url.search = rest.slice(questionIdx, hashIdx);
            url.query = rest.slice(questionIdx + 1, hashIdx);
        }
    }

    let firstIdx = (questionIdx !== -1 &&
                    (hashIdx === -1 || questionIdx < hashIdx)
                        ? questionIdx : hashIdx);

    if (firstIdx === -1) {
        if (rest.length > 0) {
            url.pathname = rest;
        }
    } else if (firstIdx > 0) {
        url.pathname = rest.slice(0, firstIdx);
    }

    if (slashedProtocol[lowerProto] && url.hostname && !url.pathname) {
        url.pathname = "/";
    }

    // to support http.request
    if (url.pathname || url.search) {
        const p = url.pathname || "";
        const s = url.search || "";

        url.path = p + s;
    }

    if (url.search && url.search.length === 1) {
        url.hassearch = true;
        url.search = null;
    }

    // finally, reconstruct the href based on what has been validated.
    url.href = format(url);

    return url;
}

/// format a parsed object into a url string
function format(url) {
    let auth = url.auth || "";

    if (auth) {
        const encoded = encodeAuth(auth);
        auth = encoded ? encoded + "@" : "";
    }

    let protocol = url.protocol || "";
    let pathname = url.pathname || "";
    let hash = url.hash || (url.hashash && "#") || "";
    let host = "";
    let query = "";

    if (url.host) {
        host = auth + url.host;
    } else if (url.hostname) {
        host = auth + (url.hostname.indexOf(":") === -1 ? url.hostname
                                                        : `[${url.hostname}]`);
        if (url.port) {
            host += ":" + url.port;
        }
    }

    if (url.query !== null && typeof url.query === "object") {
        query = QueryString.encode(url.query);
    }

    let search = url.search || (query && ("?" + query)) || (url.hassearch && "?") || "";

    if (protocol && protocol.charCodeAt(protocol.length - 1) !== CHAR_COLON) {
        protocol += ":";
    }

    let newPathname = "";
    let lastPos = 0;

    for (let i = 0; i < pathname.length; ++i) {

        switch (pathname.charCodeAt(i)) {

        case CHAR_HASHSIGN:
            if (i - lastPos > 0) {
                newPathname += pathname.slice(lastPos, i);
            }
            newPathname += "%23";
            lastPos = i + 1;
            break;

        case CHAR_QUESTIONMARK:
            if (i - lastPos > 0) {
                newPathname += pathname.slice(lastPos, i);
            }
            newPathname += "%3F";
            lastPos = i + 1;
            break;
        }
    }

    if (lastPos > 0) {
        if (lastPos !== pathname.length) {
            pathname = newPathname + pathname.slice(lastPos);
        } else {
            pathname = newPathname;
        }
    }

    // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
    // unless they had them to begin with.
    if (url.slashes || slashedProtocol[protocol]) {

        if (url.slashes || host) {
            if (pathname && pathname.charCodeAt(0) !== CHAR_SLASH) {
                pathname = "/" + pathname;
            }
            host = "//" + host;
        } else if (protocol.length >= 4 &&
                   protocol.charCodeAt(0) === CHAR_F &&
                   protocol.charCodeAt(1) === CHAR_I &&
                   protocol.charCodeAt(2) === CHAR_L &&
                   protocol.charCodeAt(3) === CHAR_E) {
            host = "/";
        }
    }

    search = search.replace(/#/g, "%23");

    if (hash && hash.charCodeAt(0) !== CHAR_HASHSIGN) {
        hash = "#" + hash;
    }

    if (search && search.charCodeAt(0) !== CHAR_QUESTIONMARK) {
        search = "?" + search;
    }

    return protocol + host + pathname + search + hash;
}

function resolve(url, relativein) {
    let relative = relativein;

    if (typeof relative === "string") {
        relative = parse(relativein, true);
    }

    const result = new Url();

    Dict.each(url, k => (result[k] = url[k]));

    if (relative === null) {
        return result;
    }

    // hash is always overridden, no matter what.
    // even href="" will remove it.
    result.hash = relative.hash;
    result.hashash = relative.hashash;

    // if the relative url is empty, then there"s nothing left to do here.
    if (relative.href === "") {
        result.href = format(result);

        return result;
    }


    // hrefs like //foo/bar always cut to the protocol.
    if (relative.slashes && !relative.protocol) {
        // take everything except the protocol from relative
        Dict.each(relative, k => {
            if (k !== "protocol") {
                result[k] = relative[k];
            }
        });

        //urlParse appends trailing / to urls like http://www.example.com
        if (slashedProtocol[result.protocol] &&
            result.hostname &&
            !result.pathname) {
            result.path = result.pathname = "/";
        }

        result.href = format(result);

        return result;
    }

    if (relative.protocol && relative.protocol !== result.protocol) {
        // if it"s a known url protocol, then changing
        // the protocol does weird things
        // first, if it"s not file:, then we MUST have a host,
        // and if there was a path
        // to begin with, then we MUST have a path.
        // if it is file:, then the host is dropped,
        // because that"s known to be hostless.
        // anything else is assumed to be absolute.

        if (!relative.slashes && !slashedProtocol[relative.protocol]) {
            Dict.each(relative, k => (result[k] = relative[k]));
            result.href = format(result);
            return result;
        }

        if (slashedProtocol[relative.protocol] && relative.slashes === false) {
            const slashes = `/${relative.pathname[0] === "/" ? "" : "/"}`;
            const tail = relative.href.substr(relative.href.indexOf(":") + 1);
            return resolve(url, `${relative.protocol}${slashes}${tail}`);
        }

        result.protocol = relative.protocol;

        if (!relative.host && /^file:?$/.test(relative.protocol) === false &&
            !hostlessProtocol[relative.protocol]) {
            const relPath = (relative.pathname || "").split("/");

            // while (relPath.length && !(relative.host = relPath.shift()));

            if (!relative.host) {
                relative.host = "";
            }

            if (!relative.hostname) {
                relative.hostname = "";
            }

            if (relative.hostname.length === 0) {
                relative.host = null;
                relative.hostname = null;
            }

            // if (relPath[0] !== "") {
            //     relPath.unshift("");
            // }

            if (relPath.length < 2) {
                relPath.unshift("");
            }

            result.pathname = relPath.join("/");
        } else {
            result.pathname = relative.pathname;
        }

        result.search = relative.search;
        result.hassearch = relative.hassearch;
        result.query = relative.query;
        result.host = relative.protocol === "file:" ? null : relative.host;
        setAuth(result, relative.auth);
        result.hostname = relative.protocol === "file:" ? null : relative.hostname || relative.host;
        result.port = relative.port;

        // to support http.request
        if (result.pathname || result.search) {
            const p = result.pathname || "";
            const s = result.search || "";
            result.path = p + s;
        }

        result.slashes = result.slashes || relative.slashes;
        result.href = format(result);

        return result;
    }

    const isSourceAbs = (result.pathname && result.pathname.charAt(0) === "/");
    const isRelAbs = (
        relative.host ||
        relative.pathname && relative.pathname.charAt(0) === "/"
    );

    let mustEndAbs = (isRelAbs || isSourceAbs ||
                      (result.host && relative.pathname));
    const removeAllDots = mustEndAbs;
    let srcPath = result.pathname && result.pathname.split("/") || [];

    let relPath;

    if (relative.protocol === null && relative.pathname) {
        const escaped = autoEscapeStr(relative.pathname) || relative.pathname;
        relPath = escaped && escaped.split("/") || []
    } else {
        relPath = relative.pathname && relative.pathname.split("/") || [];
    }


    let psychotic = result.protocol && !slashedProtocol[result.protocol];



    // if the url is a non-slashed url, then relative
    // links like ../.. should be able
    // to crawl up to the hostname, as well.  This is strange.
    // result.protocol has already been set by now.
    // Later on, put the first path part into the host field.
    if (psychotic) {
        result.hostname = "";
        result.port = null;

        if (result.host) {
            if (srcPath[0] === "") {
                srcPath[0] = result.host;
            } else {
                srcPath.unshift(result.host);
            }
        }

        result.host = "";

        if (relative.protocol) {
            relative.hostname = null;
            relative.port = null;
            setAuth(result, null);

            if (relative.host) {
                if (relPath[0] === "") {
                    relPath[0] = relative.host;
                } else {
                    relPath.unshift(relative.host);
                }
            }

            relative.host = null;
        }

        mustEndAbs = mustEndAbs && (relPath[0] === "" || srcPath[0] === "");
    }

    if (isRelAbs) {
      // it"s absolute.
        if (relative.host || relative.host === "") {
            if (result.host !== relative.host) {
                setAuth(result, null);
            }
            result.host = relative.host;
            result.port = relative.port;
        }

        if (relative.hostname || relative.hostname === "") {
            if (result.hostname !== relative.hostname) {
                setAuth(result, null);
            }
            result.hostname = relative.hostname;
        }

        result.search = relative.search;
        result.hassearch = relative.hassearch;
        result.query = relative.query;
        srcPath = relPath;

    } else if (relPath.length) {
        // it"s relative
        // throw away the existing file, and take the new path instead.
        if (!srcPath) {
            srcPath = [];
        }

        srcPath.pop();
        srcPath = srcPath.concat(relPath);
        result.search = relative.search;
        result.hassearch = relative.hassearch;
        result.query = relative.query;

    } else if (relative.hassearch ||
               (relative.search !== null && relative.search !== void(0))) {
        // just pull out the search.
        // like href="?foo".
        // Put this after the other two cases because it simplifies the booleans
        if (psychotic) {
            result.hostname = result.host = srcPath.shift();
            //occasionally the auth can get stuck only in host
            //this especially happens in cases like
            //url.resolveObject("mailto:local1@domain1", "local2@domain2")
            const authInHost = result.host && result.host.indexOf("@") > 0 ?
                               result.host.split("@") : false;

            if (authInHost) {
                setAuth(result, authInHost.shift());
                result.host = result.hostname = authInHost.shift();
            }
        }

        result.search = relative.search;
        result.hassearch = relative.hassearch;
        result.query = relative.query;

        //to support http.request
        if (result.pathname !== null || result.search !== null) {
            result.path = (result.pathname ? result.pathname : "") +
                            (result.search ? result.search : "");
        }

        result.href = format(result);

        return result;
    }

    if (!srcPath.length) {
        // no path at all.  easy.
        // we"ve already handled the other stuff above.
        result.pathname = null;
        //to support http.request
        if (result.search) {
            result.path = "/" + result.search;
        } else {
            result.path = null;
        }

        result.href = result.format();

        return result;
    }

    // if a url ENDs in . or .., then it must get a trailing slash.
    // however, if it ends in anything else non-slashy,
    // then it must NOT get a trailing slash.
    let last = srcPath.slice(-1)[0];
    const hasTrailingSlash = (
        (result.host || relative.host || srcPath.length > 1) &&
        (last === "." || last === "..") || last === "");

    // strip single dots, resolve double dots to parent dir
    // if the path tries to go above the root, `up` ends up > 0
    let up = 0;

    for (let i = srcPath.length - 1; i >= 0; i--) {
        last = srcPath[i];

        if (last === ".") {
            spliceOne(srcPath, i);
        } else if (last === "..") {
            spliceOne(srcPath, i);
            up++;
        } else if (up) {
            spliceOne(srcPath, i);
            up--;
        }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (!mustEndAbs && !removeAllDots) {
        for (; up--; up) {
            srcPath.unshift("..");
        }
    }

    if (mustEndAbs && srcPath[0] !== "" &&
        (!srcPath[0] || srcPath[0].charAt(0) !== "/")) {
        srcPath.unshift("");
    }

    if (hasTrailingSlash && (srcPath.join("/").substr(-1) !== "/")) {
        srcPath.push("");
    }

    const isAbsolute = srcPath[0] === "" ||
        (srcPath[0] && srcPath[0].charAt(0) === "/");

    // put the host back
    if (psychotic) {
        result.hostname = result.host = isAbsolute ? "" :
                                      srcPath.length ? srcPath.shift() : "";
        //occasionally the auth can get stuck only in host
        //this especially happens in cases like
        //url.resolveObject("mailto:local1@domain1", "local2@domain2")
        const authInHost = result.host && result.host.indexOf("@") > 0 ?
                                      result.host.split("@") : false;
        if (authInHost) {
            setAuth(result, authInHost.shift());
            result.host = result.hostname = authInHost.shift();
        }
    }

    mustEndAbs = mustEndAbs || (result.host && srcPath.length);

    if (mustEndAbs && !isAbsolute) {
        srcPath.unshift("");
    }

    if (!srcPath.length) {
        result.pathname = null;
        result.path = null;
    } else {
        result.pathname = srcPath.join("/");
    }

    //to support request.http
    if (result.pathname !== null || result.search !== null) {
        result.path = (result.pathname ? result.pathname : "") +
                        (result.search ? result.search : "");
    }

    setAuth(result, relative.auth || result.auth);

    result.slashes = result.slashes || relative.slashes;
    result.href = format(result);

    return result;
}

// Internals

function setAuth(url, auth) {
    if (!auth) {
        url.auth = null;
        url.username = null;
        url.password = null;
        return;
    }

    url.auth = auth;

    const tailing = url.auth.indexOf(":") === url.auth.length - 1;
    const encoded = encodeAuth(url.auth) + (tailing ? ":" : "");
    const idx = encoded.indexOf(":");

    if (idx !== -1) {
        url.username = idx === 0 ? null : encoded.substr(0, idx);
        url.password = idx === encoded.length - 1
                        ? null : encoded.substr(idx + 1);
    }

}

function autoEscapeStr(rest) {
    let newRest = "";
    let lastPos = 0;

    for (let i = 0; i < rest.length; ++i) {

        // Automatically escape all delimiters and unwise characters
        // from RFC 2396
        // Also escape single quotes in case of an XSS attack
        switch (rest.charCodeAt(i)) {

        case CHAR_TAB:
            if (i - lastPos > 0) {
                newRest += rest.slice(lastPos, i);
            }
            newRest += "%09";
            lastPos = i + 1;
            break;

        case CHAR_NEWLINE:
            if (i - lastPos > 0) {
                newRest += rest.slice(lastPos, i);
            }
            newRest += "%0A";
            lastPos = i + 1;
            break;

        case CHAR_RETURN:
            if (i - lastPos > 0) {
                newRest += rest.slice(lastPos, i);
            }
            newRest += "%0D";
            lastPos = i + 1;
            break;

         case CHAR_SPACE:
             if (i - lastPos > 0) {
                 newRest += rest.slice(lastPos, i);
             }
             newRest += "%20";
             lastPos = i + 1;
             break;

          case CHAR_QUOTE:
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%22";
              lastPos = i + 1;
              break;

          case CHAR_SQUOTE:
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%27";
              lastPos = i + 1;
              break;

          case CHAR_LT:
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%3C";
              lastPos = i + 1;
              break;

          case CHAR_GT:
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%3E";
              lastPos = i + 1;
              break;

          case CHAR_BACKSLASH:  // "\\"
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%5C";
              lastPos = i + 1;
              break;

          case 94:  // "^"
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%5E";
              lastPos = i + 1;
              break;

          case 96:  // "`"
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%60";
              lastPos = i + 1;
              break;

          case 123: // "{"
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%7B";
              lastPos = i + 1;
              break;

          case 124: // "|"
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%7C";
              lastPos = i + 1;
              break;

          case 125: // "}"
              if (i - lastPos > 0) {
                  newRest += rest.slice(lastPos, i);
              }
              newRest += "%7D";
            lastPos = i + 1;
            break;
        }
    }

    if (lastPos === 0) {
        return;
    }

    if (lastPos < rest.length) {
        return newRest + rest.slice(lastPos);
    } else {
        return newRest;
    }
}

function escapeHash(str) {
    let str2 = "";

    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);

        if (ch > 0xff) {
            str2 += encodeURIComponent(str[i]);
        } else {
            str2 += String.fromCharCode(ch);
        }
    }

    return str2;
}

function parseHost(url) {
    let host = url.host;
    let i = 0;

    let bracket = false;

    for (i = 0; i < host.length; i++) {
        const ch = host.charCodeAt(i);

        if (ch === CHAR_BRACKETL) {
            bracket = true;
        } else if (ch === CHAR_BRACKETR) {
            bracket = false;
        } else if (ch === CHAR_COLON && bracket === false) {
            break;
        }
    }

    if (bracket) {
        throw new Error("Unterminated bracket in host");
    }

    if (i !== host.length) {
        const port = host.slice(i);

        if (port !== ":") {
            const slice = port.slice(1);

            if (/^[0-9\n]+$/.test(slice) === false) {
                throw new Error("Invalid port");
            }

            const intport = parseInt(slice, 10);

            if (intport > 0xffff) {
                throw new Error("Invalid port");
            }

            if (isNaN(intport) === false &&
                (url.protocol !== "http:" || intport !== 80)) {
                url.port = String(intport);
            }
        }

        host = host.slice(0, host.length - port.length);
    }

    if (host) {
        url.hostname = host;
    }
}

function encodeAuth(str) {
    let out = "";
    let lastPos = 0;

    let seen_colon = false;

    for (let i = 0; i < str.length; ++i) {
        let c = str.charCodeAt(i);

        // These characters do not need escaping:
        // ! - . _ ~ &
        // " ( ) * :
        // digits
        // alpha (uppercase)
        // alpha (lowercase)
        if (c === 0x21 || c === 0x2D || c === 0x26 ||  c === 0x2E ||
            c === 0x5F || c === 0x7E ||
            (c >= 0x27 && c <= 0x2A) ||
            (c >= 0x30 && c <= 0x3A) ||
            (c >= 0x41 && c <= 0x5A) ||
            (c >= 0x61 && c <= 0x7A)) {
                if (c === 0x3A) {
                    if (!seen_colon) {
                        seen_colon = true;
                        continue;
                    }
                } else {
                    continue;
                }
        }

        if (i - lastPos > 0) {
            out += str.slice(lastPos, i);
        }

        lastPos = i + 1;

        // Other ASCII characters
        if (c < 0x80) {
            out += hexTable[c];
            continue;
        }

        // Multi-byte characters ...
        if (c < 0x800) {
            out += hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)];
            continue;
        }

        if (c < 0xD800 || c >= 0xE000) {
            out += hexTable[0xE0 | (c >> 12)] +
                   hexTable[0x80 | ((c >> 6) & 0x3F)] +
                   hexTable[0x80 | (c & 0x3F)];
            continue;
        }

        // Surrogate pair
        ++i;
        let c2;

        if (i < str.length) {
            c2 = str.charCodeAt(i) & 0x3FF;
        } else {
            c2 = 0;
        }

        c = 0x10000 + (((c & 0x3FF) << 10) | c2);

        out += hexTable[0xF0 | (c >> 18)] +
               hexTable[0x80 | ((c >> 12) & 0x3F)] +
               hexTable[0x80 | ((c >> 6) & 0x3F)] +
               hexTable[0x80 | (c & 0x3F)];
    }

    if (lastPos === 0) {
        out = str;
    } else if (lastPos < str.length) {
        out = out + str.slice(lastPos);
    }

    if (out.length === 1 && out[0] === ":") {
        return "";
    }

    if (out[out.length - 1] === ":") {
        out = out.slice(0, out.length - 1);
    }

    return out;
}

function validateHostname(url, rest, hostname) {
    for (let i = 0, lastPos; i <= hostname.length; ++i) {
        let code;

        if (i < hostname.length) {
            code = hostname.charCodeAt(i);
        }

        if (code === CHAR_DOT || i === hostname.length) {
            if (i - lastPos > 0) {
                if (i - lastPos > CHAR_QUESTIONMARK) {
                    url.hostname = hostname.slice(0, lastPos + CHAR_QUESTIONMARK);
                    return "/" + hostname.slice(lastPos + CHAR_QUESTIONMARK) + rest;
                }
            }
            lastPos = i + 1;
            continue;
        } else if ((code >= 48/*0*/ && code <= 57/*9*/) ||
                   (code >= 97/*a*/ && code <= 122/*z*/) ||
                    code === 45/*-*/ ||
                   (code >= 65/*A*/ && code <= 90/*Z*/) ||
                    code === 43/*+*/ ||
                    code === 95/*_*/ ||
                   code > 127) {
            continue;
        }

        // Invalid host character
        url.hostname = hostname.slice(0, i);

        if (i < hostname.length) {
            return "/" + hostname.slice(i) + rest;
        }
        break;
    }
}

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
    for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1) {
        list[i] = list[k];
    }
    list.pop();
}

function trimWhitespaces(str) {
    let out = "";

    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        if (isWhitespace(ch) === false) {
            if (ch === CHAR_COLON) {
                out += str.slice(i);
                break;
            }

            out += String.fromCharCode(ch);
        }

    }

    return out;
}

function isHostlessProtocol(p) {
    return p in slashedProtocol === false;
}

function isWhitespace(ch) {
    return ch === CHAR_TAB
        || ch === CHAR_SPACE
        || ch === CHAR_RETURN
        || ch === CHAR_NEWLINE
        || ch === CHAR_FEED
        || ch === 160/*\u00A0*/
        || ch === 65279/*\uFEFF*/;
}

// function formatError(message="Url mallformed") {
//     return new Error(message);
// }

function ipv6Error(message="Invalid IPv6 address") {
    return new Error(message);
}

function ipv6AddressToString(ip) {
    const parts = [];

    let seen_zero = false;
    let last_val;

    for (let i = 0; i < ip.length; i++) {
        const val = ip[i];

        if (val === 0) {
            if (seen_zero) {
                parts.push(val.toString(16))
            } else {
                if (last_val !== 0) {
                    parts.push("");
                }
            }
        } else {
            if (last_val === 0) {
                seen_zero = true;
            }
            parts.push(val.toString(16));
        }

        last_val = val;
    }

    return (ip[0] === 0 ? ":" : "") + parts.join(":") + (last_val === 0 ? ":" : "");
}

function parseIPv6Address(str) {
    const double_parts_idx = str.indexOf("::");

    if (double_parts_idx === -1) {
        const parts = parseIPv6Parts(str);

        if (parts.length !== 8) {
            throw ipv6Error();
        }

        return ipv6AddressToString(new Uint16Array(parts));
    }

    const head_parts = parseIPv6Parts(str.substr(0, double_parts_idx));
    const tail_parts = parseIPv6Parts(str.substr(double_parts_idx + 2));

    if (head_parts.length + tail_parts.length > 8) {
        throw ipv6Error();
    }

    const ip = new Uint16Array(8);

    for (let i = 0; i < head_parts.length; i++) {
        ip[i] = head_parts[i];
    }

    const offset = 8 - tail_parts.length;
    for (let i = 0; i < tail_parts.length; i++) {
        ip[offset + i] = tail_parts[i];
    }

    return ipv6AddressToString(ip);
}

function parseIPv6Parts(str) {
    if (str.length === 0) {
        return [];
    }

    const parts = [];

    List.each(str.split(":"), (part) => {
        if (part.indexOf(".") === -1) {
            if (/^[a-f0-9]{1,4}$/.test(part) === false) {
                throw ipv6Error();
            }
            return parseIPv6AppendPart(parts, parseInt(part, 16));
        }

        if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(part) === false) {
            throw ipv6Error();
        }

        const v4parts = part.split(".");

        if (v4parts.length !== 4) {
            throw ipv6Error();
        }

        parseIPv6AppendPart(parts, parseInt(v4parts[1], 10) |
                                   parseInt(v4parts[0], 10) << 8);

        parseIPv6AppendPart(parts, parseInt(v4parts[3], 10) |
                                   parseInt(v4parts[2], 10) << 8);
    });

    return parts;
}


function parseIPv6AppendPart(parts, no) {
    if (isNaN(no) || no < 0 || no > 0xffff) {
        throw ipv6Error();
    }

    parts.push(no);
}

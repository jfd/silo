import ChildProcess from "child_process";

import * as List from "../src/List.mjs";
import * as Path from "../src/Path.mjs";
import * as Str from "../src/Str.mjs";
import * as Url from "../src/Url.mjs";

import * as Docopt from "../src/Docopt.mjs";

const USAGE = `
Usage:
    silo-build [options] [<path>]

Options:
    -h, --help               Print this message
        --format=FORMAT      Output format, default: cjs
        --output-path=PATH   Output path, default: "./dist/app.js"
`;

export default function(argv) {
    const opts = Docopt.parse(USAGE, argv);

    let inputPath;

    if (opts["<path>"]) {
        inputPath = Path.resolve(process.cwd(), opts["<path>"]);
    } else {
        inputPath = Path.resolve(process.cwd(), "index.mjs");
    }

    const outputPath = opts["--output-path"] || "dist/app.js";
    const format = opts["--format"] || "cjs";

    return internalExec(inputPath, outputPath, format);
}

// Internals

async function internalExec(inputPath, outputPath, format) {
    const url = Url.parse(import.meta.url);
    const rootdir = Path.dirname(Path.dirname(url.pathname));
    const rollupPath = Path.resolve(rootdir, "./node_modules/rollup/dist/bin/rollup");
    const loaderPath = Path.resolve(rootdir, "./src/RollupModuleLoader.js");

    let args = [
        rollupPath,
        inputPath,
        `--file ${outputPath}`,
        `--format ${format}`,
        `--plugin ${loaderPath}`
    ];

    if (format === "cjs") {
        args = List.append(args, `--outro "${outroLauncher().split("\n").join(" ")}"`);
    }

    try {
        const result = await promiseExec(Str.join(args, " "));
        console.log(result);
    } catch (error) {
        console.error(error);
    }
}

function promiseExec(cmd) {
    return new Promise((resolve, reject) => {
        ChildProcess.exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.log(">>>>>>>>>>>>> STDOUT");
                console.log(stdout);
                console.log("<<<<<<<<<<<<< STDOUT");
                return reject(error);
            }

            resolve(stdout);
        });
    });
}

function outroLauncher() {
    return `
        (async function() {
            try {
                await module.exports(process.argv.slice(2));
            } catch (error) {
                if (error.appMessage) {
                    console.error(error.appMessage);
                    return process.exit(error.appExitCode || 1);
                }
                console.log(error);
                return process.exit(1);
            }
        })();
    `;
}

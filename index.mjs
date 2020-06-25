#!/usr/bin/env node
//#!/usr/bin/env node --experimental-loader ./loader.mjs
import ChildProcess from "child_process";
import Path from "path";
import Url from "url";

(async () => {
    const path = Url.parse(import.meta.url).pathname;
    const dirname = Path.dirname(path);

    if (!process.env["__SILO_PARENT_PID__"]) {
        const loader = Path.join(dirname, "loader.mjs");
        const env = Object.assign({__SILO_PARENT_PID__: process.pid}, process.env);
        const execArgv = ["--experimental-loader", loader];

        return ChildProcess.fork(path, process.argv.slice(2), {env, execArgv});
    }

    if ("SILO_INSTALL_PATH" in process.env === false) {
        process.env["SILO_INSTALL_PATH"] = dirname;
    }

    if (process.env["SILO_DEBUG"]) {
        console.log(`Install path: ${process.env["SILO_INSTALL_PATH"]}`);
    }

    const App = await import(Path.join(dirname, "src", "App.mjs"));
    return App.default(process.argv.slice(2));
})();

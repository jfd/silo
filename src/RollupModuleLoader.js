module.exports = function silo () {
    return {
        name: 'silo', // this name will show up in warnings and errors
        resolveId ( source ) {
            console.log("RESOLVE ID");
            console.log(source);
            if (source === 'virtual-module') {
                return source; // this signals that rollup should not ask other plugins or check the file system to find this id
            }
            return null; // other ids should be handled as usually
        },
        load ( id ) {
            console.log("LOAD ID");
            console.log(id);
            if (id === 'virtual-module') {
                return 'export default "This is virtual!"'; // the source code for "virtual-module"
            }
            return null; // other ids should be handled as usually
        }
    };
}

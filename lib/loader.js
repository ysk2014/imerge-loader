let _ = require("lodash");
let plugin = require('./Plugin');
let IParse = require("./core/iParser");

function ImergeLoader (content, map, meta) {
    let iparse = new IParse({content:content, filePath: this.resourcePath}, this.ImergePlugin.options);
    iparse.parse();
    addDependency.call(this, iparse.config)
    this.ImergePlugin.imagesConfig = _.extend(this.ImergePlugin.imagesConfig, iparse.config);
    this.ImergePlugin.options.sourceContext = this.context;
    return iparse.content;
};

ImergeLoader.Plugin = plugin;

module.exports = ImergeLoader;

let addDependency = (params) => {
    if (params.length>0) {
        Object.values(params).forEach(val => {
            Object.keys(val).forEach(src => {
                new Promise((resolve, reject) => {
                    this.resolve(this.context, src, (err, result) => err ? reject(err) : resolve(result));
                }).then((file) => {
                    this.addDependency(file);
                });
            })
        });
    }
}
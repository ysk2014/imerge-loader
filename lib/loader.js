let _ = require("lodash");
let plugin = require('./Plugin');
let IParse = require("./core/iParser");

function ImergeLoader (content, map, meta) {
    let iparse = new IParse({content:content, filePath: this.resourcePath}, this.ImergePlugin.options);
    iparse.parse();
    this.ImergePlugin.imagesConfig = _.extend(this.ImergePlugin.imagesConfig, iparse.config);
    this.ImergePlugin.options.sourceContext = this.context;
    return iparse.content;
};

ImergeLoader.Plugin = plugin;

module.exports = ImergeLoader;
var IImage = require('./core/iImage.js'),
    ILayout = require('./core/iLayout.js'),
    IReplace = require('./core/iReplace.js'),
    ISprite = require('./core/iSprite.js'),
    Q = require('q'),
    _ = require('lodash'),
    utils = require('./core/utils'),
    chalk = require('chalk'),
    path = require('path'),
    hash = require("hash-sum"),
    Source = require('webpack-sources'),
    RawSource = require('webpack-sources').RawSource;

class ImergePlugin {
    constructor(options) {
        var opt = this.options = utils.extend(true, {
            // 存放处理后的sprite image目录
            spriteTo: './images/imerge/',
            defaults: {
                // 小图在sprite中间距，类似css的写法
                padding: null
            },
            // 是否扫描所有background background-image，而不用管是否设置了merge属性
            all: false
        }, options);

        opt.outputContext = "";  // 编译后的文件目录
        opt.sourceContext = "";  // 原始css文件目录
    
        this.imagesConfig = {};
        this.imagesData = {};
    }

    apply(compiler) {
        compiler.plugin('after-plugins', (compiler) => {
            this.images = {};
        });

        compiler.plugin('this-compilation', (compilation, params) => {
            compilation.plugin('additional-assets', (callback) => {
                this.sprite(this.imagesConfig).then((data) => {
                    this.imagesData = data;
                    callback();
                });
            });
            compilation.plugin('optimize-chunk-assets', (chunks, callback) => {
                chunks.forEach((chunk) => {
                    chunk.files.forEach((file) => {
                        if (file.endsWith('.css')) {
                            // 处理css模块
                            let content = compilation.assets[file].source();
                            content = this.replace(content);
                            compilation.assets[file] = new RawSource(content);
                        }
                    });
                });
                callback()
            });
        });
        

        compiler.plugin("compilation", (compilation, params) => {
            compilation.plugin("normal-module-loader", (loaderContext, module) => {
                loaderContext.ImergePlugin = this;
                this.options.outputContext = path.resolve(process.cwd(), compilation.options.output.path);

                if (!path.isAbsolute(this.options.spriteTo)) {
                    this.options.spriteTo = path.resolve(this.options.outputContext, this.options.spriteTo);
                }
                
                this.options.publicPath = compilation.options.output.publicPath;
            });
        })
    }

    layout(data) {
        var imageList = [];

        return Q.all(_.map(data, function(conf, path) {
            var image = new IImage(path, conf);
            return image.init().then(function() {
                imageList.push(image);
            }, function(error) {
                console.log(error);
            });
        })).then(function() {
            return new ILayout(imageList);
        });
    }

    sprite(config) {
        var ret = {},
            self = this,
            pathFilter = function(merge, layout) {
                return path.join(self.options.spriteTo, '/' + hash(layout.blocks) + hash(layout.group) + hash(layout.border) + hash(layout.root) + '.' + merge + '.png');
            };

        return Q.all(_.map(config, function(value, merge) {
            return self.layout(value).then(function(layout) {
                var sprite = new ISprite(layout.blocks, layout.root.width, layout.root.height),
                    file = pathFilter(merge, layout);
                return sprite.writeSprite(file).then(function() {
                    ret[merge] = sprite;
                });
            })
        })).then(function() {
            return ret;
        });
    }

    kvData() {
        _.each(this.imagesData, function(sprite) {
            sprite.data = {};
            _.each(sprite.images, function(image) {
                sprite.data[image.file] = image;
            });
        });
    }

    replace (content) {
        this.kvData();

        var iReplace = new IReplace(content, this.imagesData, this.options);
        return iReplace.replace();
    }
}

module.exports = ImergePlugin;
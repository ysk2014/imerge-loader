var Q = require('q'),
    _ = require('lodash'),
    css = require('css'),
    fs = require('fs-extra'),
    Path = require('path'),
    utils = require('./utils.js');

var number_reg = /^((\+|-)?(\d*\.)?(\d+))(px)?$/;

function matchSize(value) {
    return value.trim().match(number_reg);
}

var IReplace = module.exports = function(content, data, options) {
    this.data = data;
    this.options = options;
    this.content = content;
};

IReplace.prototype = {
    constructor: IReplace,

    matchSize: matchSize,

    replace: function() {
        var obj = this.parse(this.content);
        this.content = css.stringify(obj, {
            compress: true
        });
        return this.content;
    },

    parse: function(content) {
        var self = this,
            obj = css.parse(content);

        utils.cssBgWalk({
            cssAst: obj,
            options: self.options,
            ruleDoneHandler: function (rule, ruleResult, merge, isHack) {
                _.each(ruleResult, function (bgObj) {
                    self.rewriteBackground(rule, bgObj.bgDecls, bgObj.merge, bgObj.isHack);
                });
            }
        });

        return obj;
    },

    rewriteBackground: function(rule, bgDecls, merge, isHack) {
        var data, url;
        _.each(bgDecls, _.bind(function(bgDecl) {
            var property = bgDecl.property;
            if (isHack) {
                property = property.replace(/^_/, '');
            }
            if (property === 'background' || property === 'background-image') {
                var reg = new RegExp(`(.*REPLACE_${merge}\\()([\\'\\"]?)([^\\'\\"\\)]+)([\\'\\"]?)(\\).*)`);
                var matches = bgDecl.value.match(reg);
                if (matches) {
                    url = matches[3];
                    data = this.getDataByUrl(url, merge);
                    // 只有合图信息存在时，才替换，找不到小图的不替换
                    if (data && data.data && data.data.fit) {
                        bgDecl.value = 'url("' + data['url'] + '"' + matches[5];
                    }
                }
            }
        }, this));

        if (data && data.data && data.data.fit) {
            data = data.data;
            var fit = data.fit,
                conf = data.config,
                position = {
                    left: fit.x + conf['padding-left'],
                    top: fit.y + conf['padding-top']
                };
            this.rewriteBackgroundSize(bgDecls, data, this.data[merge], position);
            this.rewriteBackgroundPosition(rule, bgDecls, position, isHack);
        }
    },

    getDataByUrl: function(url, merge) {
        var opt = this.options,
            ret = {
                url: url,
                data: {}
            };

        if (!url || ~url.indexOf('data:') || ~url.indexOf('about:') || ~url.indexOf('://')) {
            return ret;
        }

        if (utils.isAbsolute(url)) {
            url = Path.join(opt.sourceContext, url);
            ret.url = this.data[merge]['toFile'].replace(opt.outputContext, '').replace(/\\/g, '/');
        } else {
            url = Path.resolve(opt.sourceContext, url);
            ret.url = Path.join(opt.publicPath, Path.relative(opt.outputContext, this.data[merge]['toFile'])).replace(/\\/g, '/');
        }
        ret.data = this.data[merge]['data'][url];
        return ret;
    },

    rewriteBackgroundSize: function(bgDecls, data, attr, position) {
        var ratio = {width: 1, height: 1},
            self = this;
        _.each(bgDecls, function(bgDecl) {
            if (~bgDecl.property.indexOf('background-size')) {
                var bgSize = bgDecl.value.split(/\s+/),
                    order = 'width',
                    setTimes = 0;
                _.each(bgSize, function(size, index) {
                    var matches;
                    if (matches = self.matchSize(size)) {
                        size = matches[1];
                        ratio[order] = size / data['ori' + order.substring(0, 1).toLocaleUpperCase() + order.substring(1)];
                        size = +(ratio[order] * attr[order]).toFixed(1);
                        bgSize[index] = size + 'px';
                        setTimes++;
                    }
                    order = 'height';
                });
                bgDecl.value = bgSize.join(' ');

                if (setTimes < 2) {
                    if (ratio.width !== 1) {
                        ratio.height = ratio.width;
                    } else if (ratio.height !== 1) {
                        ratio.width = ratio.height;
                    }
                }
            }
        });

        position.left = +(position.left * ratio.width).toFixed(1);
        position.top = +(position.top * ratio.height).toFixed(1);
    },

    rewriteBackgroundPosition: function(rule, bgDecls, position, isHack) {
        var posDecl;
        _.find(bgDecls, function(bgDecl) {
            var property = bgDecl.property;
            if (isHack) {
                property = property.replace(/^_/, '');
            }
            if (property === 'background-position') {
                posDecl = bgDecl;
                return true;
            } else if (property === 'background') {
                posDecl = bgDecl;
            }
            return false;
        });

        if (posDecl) {
            var posValues = posDecl.value.split(/\s+/);
            if (this.setPosition(posValues, position)) {
                posDecl.value = posValues.join(' ');
            } else {
                this.addPositionDecl(rule.declarations, position, isHack);
            }
        } else {
            this.addPositionDecl(rule.declarations, position, isHack);
        }
    },

    setPosition: function(values, position) {
        var order = 'left',
            setTimes = 0,
            self = this;
        _.find(values, function(value, index) {
            var matches;
            if (matches = self.matchSize(value)) {
                values[index] = (matches[1] - position[order]) + 'px';
                order = 'top';
                setTimes++;
            } else if (_.isString(value) && ~['left', 'center', 'right', 'top', 'bottom'].indexOf(value)) {
                order = 'top';
                setTimes++;
            }
            return setTimes === 2;
        });

        return setTimes > 0;
    },

    addPositionDecl: function(decls, position, isHack) {
        var decl = {
            'type': 'declaration',
            'property': (isHack ? '_' : '') + 'background-position',
            'value': (-position.left) + 'px ' + (-position.top) + 'px'
        };
        decls.push(decl);
    }
};

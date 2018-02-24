/**
 * 解析css，生成配置信息
 * @type {exports}
 */

var Q = require('q'),
    _ = require('lodash'),
    css = require('css'),
    utils = require('./utils.js'),
    path = require('path'),
    fs = require('fs-extra');

var paddings = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
    COMMON = 1,
    IE6 = 2;

var IParser = module.exports = function(file, options) {
    this.content = file.content;
    this.filePath = file.filePath;

    this.defaults = utils.defaults.config;
    this.options = utils.extend(true, {
        sourceContext: '',
        defaults: {
            padding: null
        },
        all: false
    }, options);
    this.setDefaults(this.options.defaults);

    this.config = {};
    this._position = true;
};
IParser.prototype = {
    constructor: IParser,

    setDefaults: function(defaults) {
        var def = this.defaults;
        _.each(defaults, function(value, key) {
            if (value) {
                if (key === 'padding') {
                    var values = value.toString().split(' ');
                    for (var i = 0; i < 4; i++) {
                        if (_.isUndefined(values[i])) {
                            values[i] = values[i - 1];
                        }
                        def[paddings[i]] = parseInt(values[i]);
                    }
                } else {
                    if (~key.indexOf('padding')) {
                        value = parseInt(value);
                    }
                    def[key] = value;
                }
            }
        });
    },


    parse: function() {
        this._parse(this.content, this.filePath);
        this.content = css.stringify(this.cssAst, {
            compress: true
        });
    },

    _parse: function(content, file) {
        var self = this,
            bind = function (f) {
                return _.bind(self[f], self); 
            };

        return _.compose(
            _.bind(_.curry(self._doConfig)(file), self),
            bind('_filterBg'),
            bind('_parseCss')
        )(content);
    },

    _parseCss: function (content) {
        return css.parse(content);
    },

    _filterBg: function (cssAst) {
        var self = this;
        let bgList = utils.cssBgWalk({
            cssAst: cssAst,
            options: self.options,
            parse: true
        });
        this.cssAst = cssAst;

        return bgList;
    },

    _doConfig: function (cssFile, bgList) {
        var self = this;

        _.each(bgList, function (bgObj) {
            config = self._getConfigByRule(bgObj.merge, bgObj.bgDecls, bgObj.isHack);
            if (config.url) {
                var url = config.url;
                delete config.url;
                self._setConfig(bgObj.merge, url, self._getAbsPathByUrl(url, cssFile), _.extend({}, self.defaults, config));
            }
        });
    },
    
    _getConfigByRule: function(merge, bgDecls, isHack) {
        var config = {},
            self = this;
        bgDecls.forEach(function(decl) {
            // 去掉hack写法前缀
            var property = decl.property;
            if (isHack) {
                property = property.replace(/^_/, '');
            }
            switch (property) {
                case 'background':
                    _.extend(config, self._handleBackground(decl.value));
                    break;
                case 'background-image':
                    _.extend(config, self._handleBackgroundImage(decl.value));
                    break;
                case 'background-position':
                    var values = decl.value.split(/\s+/);
                    self._position = true;
                    values.forEach(function(value) {
                        _.extend(config, self._handleBackgroundPosition(value));
                    });
                    break;
                case 'background-repeat':
                    _.extend(config, self._handleBackgroundRepeat(decl.value));
                    break;
                default:
                    break;
            }
        });
        return config;
    },

    _setConfig: function(merge, url, key, config) {
        if (config.repeat === 'xy') {
            utils.log('舍弃x和y方向同时repeat的图片:' + url);
            return;
        }
        if (!this.config[merge]) {
            this.config[merge] = {};
        }
        if (!this.config[merge][key]) {
            this.config[merge][key] = config;
        } else {
            var oldConfig = this.config[merge][key];
            paddings.forEach(function(padding) {
                oldConfig[padding] = Math.max(oldConfig[padding], config[padding]);
            });

            var oF = oldConfig.float,
                nF = config.float;

            // 没有浮动，默认为none
            if (oF === 'none') {
                if (nF !== 'none') {
                    oldConfig.float = nF;
                }
            } else {
                if (nF !== 'none' && oF !== nF) {
                    // 冲突
                }
            }

            // 不写repeat，默认为none
            var oR = oldConfig.repeat,
                nR = config.repeat;
            if (oR === 'none') {
                if (nR !== 'none') {
                    oldConfig.repeat = nR;
                }
            } else {
                if (nR !== 'none' && oR !== nR) {
                    throw '图片：' + url + '，被多次引用，但存在冲突，请检查background-repeat.';
                }
            }
        }
    },

    _getAbsPathByUrl: function(url, file) {
        if (_.isString(url)) {
            if (utils.isAbsolute(url)) {
                // 如果是绝对地址
                return path.join(path.resolve(this.options.sourceContext), url);
            } else {
                // 相对地址
                return path.resolve(path.dirname(file), url);
            }
        }
        throw new Error('url必须为字符串');
    },

    _handleBackground: function(value) {
        var ret = {},
            values = value.split(/\s+/),
            self = this,
            temp;
        this._position = true;
        values.forEach(function(val) {
            if ((temp = self._handleBackgroundImage(val)) && !_.isEmpty(temp)) {
                _.extend(ret, temp);
            } else if ((temp = self._handleBackgroundPosition(val)) && !_.isEmpty(temp)) {
                _.extend(ret, temp);
            } else if ((temp = self._handleBackgroundImage(val)) && !_.isEmpty(temp)) {
                _.extend(ret, temp);
            } else if ((temp = self._handleBackgroundRepeat(val)) && !_.isEmpty(temp)) {
                _.extend(ret, temp);
            }
        });
        return ret;
    },

    _handleBackgroundImage: function(value) {
        var ret = {},
            matches = value.match(/(.*REPLACE_.*?\()([\'\"]?)([^\'\"\)]+)([\'\"]?)(\).*)/);
        if (matches) {
            var url = matches[3];
            if (!~url.indexOf('data:') && !~url.indexOf('about:') && !~url.indexOf('://')) {
                ret.url = url;
            }
        }
        return ret;
    },

    _handleBackgroundPosition: function(value) {
        var ret = {},
            matches = value.match(/^([\d\.]+)(px)?/);
        if (matches || ~['left', 'right', 'top', 'bottom', 'center'].indexOf(value.toLowerCase())) {
            if (matches) {
                value = Math.round(matches[1]);
            }
            ret = this._getPosition(value);
        }

        return ret;
    },

    _handleBackgroundRepeat: function(value) {
        var ret = {};
        if (~value.toLowerCase().indexOf('repeat')) {
            ret = this._getRepeat(value);
        }
        return ret;
    },

    _getPosition: function(value) {
        var ret = {},
            flag = this._position,
            self = this;
        if (_.isString(value)) {
            ret.float = value.toLowerCase();
        } else {
            var paddings = [
                ['padding-left', 'padding-right'],
                ['padding-top', 'padding-bottom']
            ];
            paddings = flag ? paddings[0] : paddings[1];
            paddings.forEach(function(padding) {
                ret[padding] = Math.max(self.defaults[padding], value);
            });
        }
        this._position = !flag;
        return ret;
    },

    _getRepeat: function(value) {
        var ret = {};
        // FIXME: 如果先后有两次 background-repeat, repeat无法清除之前的ret.float
        switch (value.toLowerCase()) {
            case 'repeat-x':
                ret.repeat = 'x';
                ret.float = 'left';
                break;
            case 'repeat-y':
                ret.repeat = 'y';
                ret.float = 'top';
                break;
            case 'repeat':
                ret.repeat = 'xy';
                ret.float = 'none';
                break;
            default:
                break;
        }
        return ret;
    }
};

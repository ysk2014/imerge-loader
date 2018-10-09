imerge-loader
======
webpack的css合图插件

## 特性

基于[imerge](https://www.npmjs.com/package/imerge)包做的webpack兼容插件, 不过为了兼容webpack，去掉了imerge的参数配置，请看下面的列子

## 安装

> webpack v3

```js
npm install --save-dev imerge-loader@0
```

> webpack v4

```js
npm install --save-dev imerge-loader
```

## 使用方法

``` js
const ImergePlugin = require('imerge-loader').Plugin;

module.exports = {
    ...
    module: {
        rules: [{ test: /\.css$/, use: ['style-loader', 'css-loader', 'imerge-loader'] }],
    },
    plugins: [new ImergePlugin()],
};
```

## 参数

``` js
{
    // 存放处理后的sprite image目录
    spriteTo: '',
    defaults: {
        // 小图在sprite中间距，类似css的写法
        padding: null
    },
    // 是否扫描所有background background-image，而不用管是否设置了merge属性
    all: false
}
```

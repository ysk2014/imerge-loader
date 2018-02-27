imerge-loader
======
webpack的css合图插件

## 特性

基于[imerge](https://www.npmjs.com/package/imerge)包做的webpack兼容插件, 不过为了兼容webpack，去掉了imerge的参数配置，请看下面的列子

## 安装

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
    plugins: [new ImergePlugin({
        padding: 20  //Set default padding value
    })],
};
```

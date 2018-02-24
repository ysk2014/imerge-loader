imerge-loader
======
webpack的css合图插件

## 特性

基于[imerge](https://www.npmjs.com/package/imerge)包做的webpack兼容插件

## 安装

```js
npm install -g imerge-loader
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

// const { readFileSync } = require('fs');
// const SEPARATOR = /[\r|\n]/g;
//
// function diff(source, target) {
//   const targetContent = readFileSync(target).toString('utf8').split(SEPARATOR);
//   const sourceContent = readFileSync(source).toString('utf8').split(SEPARATOR);
//   const tMap = new Map();
//   const sMap = new Map();
//   targetContent.forEach(line => {
//     const [ key, ...valueArray] = line.split(' ');
//     if (key) {
//       tMap.set(key, valueArray?.join(' ') || undefined);
//     }
//   })
//   sourceContent.forEach(line => {
//     const [ key, ...valueArray] = line.split(' ');
//     if (key) {
//       sMap.set(key, valueArray.join(' '));
//     }
//   })
//   const tKeys = tMap.keys();
//   const sKeys = sMap.keys();
//   const remove = tKeys.filter(tKey => !sMap.has(tKey));
//   const set = sKeys.filter(sKey => !tMap.has(sKey) || tMap.get(sKey) !== sMap.get(sKey));
//   const patch = {};
//   remove.forEach(key => {
//     patch[key] = undefined;
//   })
//   set.forEach(key => {
//     patch[key] = sMap.get(key);
//   })
// console.log(patch)
// }
//
// diff('./test/data2.txt', './test/data.txt')
console.log(/^\d{13}\s/.test(Date.now() + ' '))

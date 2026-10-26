import { readFile,writeFile } from 'node:fs/promises';
import { parse } from '../cloudflare/read-api/node_modules/acorn/dist/acorn.mjs';
const root=new URL('../',import.meta.url),source=await readFile(new URL('landlord-api.js',root),'utf8');
const ast=parse(source,{ecmaVersion:'latest'});let definition,clocks;
function walk(node) {
  if(!node||typeof node!=='object') return;
  if(node.type==='VariableDeclarator'&&node.id.name==='SHADOW_FIELDS') definition=node.init;
  if(node.type==='VariableDeclarator'&&node.id.name==='SHADOW_CLOCK_FIELDS') clocks=node.init;
  for(const value of Object.values(node)) if(Array.isArray(value)) value.forEach(walk);else if(value&&typeof value==='object') walk(value);
}
function constant(node) {
  if(node?.type==='Literal'&&typeof node.value==='string') return node.value;
  if(node?.type==='BinaryExpression'&&node.operator==='+') return constant(node.left)+constant(node.right);
  throw Error('Shadow vocabulary must be a literal string');
}
walk(ast);
if(definition?.type!=='NewExpression'||definition.callee.name!=='Set') throw Error('Missing vocabulary');
const split=definition.arguments[0];
if(split?.type!=='CallExpression'||split.callee.property.name!=='split'||constant(split.arguments[0])!==' ') throw Error('Invalid vocabulary');
const fields=[...new Set(constant(split.callee.object).split(' '))].sort();
if(fields.some(field=>!/^\w+$/.test(field))) throw Error('Invalid field');
await writeFile(new URL('cloudflare/read-api/shadow-fields.json',root),JSON.stringify(fields,null,2)+'\n');
function literalObject(node) {
  if(node?.type==='Literal'&&typeof node.value==='string') return node.value;
  if(node?.type!=='ObjectExpression') throw Error('Clock contract must be literal');
  return Object.fromEntries(node.properties.map(property=>{
    if(property.type!=='Property'||property.computed||property.kind!=='init') throw Error('Invalid clock contract');
    return [property.key.name||property.key.value,literalObject(property.value)];
  }));
}
await writeFile(new URL('cloudflare/read-api/shadow-clock-fields.json',root),JSON.stringify(literalObject(clocks),null,2)+'\n');
console.log('Generated fixed shadow vocabulary:',fields.length);

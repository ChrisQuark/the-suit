import {readFileSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
const r=await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'iife',write:false});
let html=readFileSync('src/index.html','utf8');
html=html.replace('<link rel="stylesheet" href="./style.css">',()=>'<style>'+readFileSync('src/style.css','utf8')+'</style>');
html=html.replace('<script type="module" src="./app.js"></script>',()=>'<script>'+r.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace('</body>',()=>'<script type="text/plain" id="third-party-licenses">'+readFileSync('THIRD_PARTY_LICENSES.txt','utf8')+'</script></body>');
writeFileSync('index.html',html);
console.log('Built self-contained GitHub Pages index.html');

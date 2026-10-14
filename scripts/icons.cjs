const fs=require('node:fs');const sharp=require('sharp');(async()=>{for(const n of [192,512])await sharp('public/icon.svg').resize(n,n).png().toFile('public/icon-'+n+'.png');})();

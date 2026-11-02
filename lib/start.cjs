// A Railway volume is mounted root-owned. Prepare only our private subdirectory,
// then drop privileges before importing or starting any application code.
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 if(process.getuid?.()===0){
  const mount=process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if(mount){
   if(!path.isAbsolute(mount)||mount==='/'||mount.startsWith('/app/public')||fs.realpathSync(mount)!==mount)throw Error('Invalid private volume mount');
   const directory=path.join(mount,'avilog-admin');try{fs.mkdirSync(directory,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}
   // Work through a no-follow directory descriptor, never a volume-supplied symlink.
   const fd=fs.openSync(directory,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
   try{if(!fs.fstatSync(fd).isDirectory())throw Error('Invalid private directory');fs.fchownSync(fd,1000,1000);fs.fchmodSync(fd,0o700);}finally{fs.closeSync(fd);}
  }
  process.setgroups([]);process.setgid(1000);process.setuid(1000);
 }
 const {createServer}=await import('../server.js');const port=Number(process.env.PORT||3000);
 createServer().listen(port,'0.0.0.0',()=>console.log(`AviLog listening on port ${port}`));
})().catch(()=>{console.error('AviLog could not initialize its private storage.');process.exitCode=1;});

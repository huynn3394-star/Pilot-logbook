/** Invalidate only the public shell when its embedded Firebase schema is rebuilt. */
export function stampBundle(source,digest){
 if(!/^[a-f0-9]{64}$/.test(digest)||!/^const BUNDLE_BUILD = "[a-z0-9-]+";/m.test(source))throw Error('Missing service-worker build marker or invalid bundle digest.');
 return source.replace(/^const BUNDLE_BUILD = "[a-z0-9-]+";/m,`const BUNDLE_BUILD = "${digest.slice(0,12)}";`);
}

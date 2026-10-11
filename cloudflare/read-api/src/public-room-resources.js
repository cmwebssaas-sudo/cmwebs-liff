// Only existing public z3House gallery URLs enter this isolate-local cache.
// Neither source HTML nor Workspace/identity/financial rows are cached.
const publicCache=new Map();
export async function loadPublicRoomResources(values,helpers,options={}) {
  const now=options.now??Date.now(),fetcher=options.fetch??fetch;
  const targets=new Map(values.map(value=>helpers.landlordRoomWebsiteCoverTarget_(value)).filter(Boolean).map(target=>[target.url,target]));
  const resources={};
  await Promise.all([...targets.values()].map(async target=>{
    let cached=publicCache.get(target.url);
    if(!cached||cached.expires<=now) {
      let status=503,photos=[];
      try {
        const response=await fetcher(target.url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(1500)});
        if(response.status===200) {
          const reader=response.body?.getReader();
          if(reader) {
            const chunks=[];let bytes=0;
            while(true) {
              const {value,done}=await reader.read();if(done) break;
              bytes+=value.byteLength;
              if(bytes>1000000) {await reader.cancel();throw new Error('Public page too large');}
              chunks.push(value);
            }
            const body=new Uint8Array(bytes);let offset=0;
            for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
            photos=helpers.landlordRoomWebsitePhotosFromHtml_(new TextDecoder().decode(body),target);
          }
          status=200;
        }
      } catch { status=503; }
      cached={status,photos,expires:now+(photos.length?21600000:60000)};
      if(publicCache.size>=256) publicCache.delete(publicCache.keys().next().value);
      publicCache.set(target.url,cached);
    }
    resources[target.url]={status:cached.status,body:'<section class="space-detail__media">'+cached.photos.map(url=>'<img src="'+url+'">').join('')+'</section>'};
  }));
  return resources;
}

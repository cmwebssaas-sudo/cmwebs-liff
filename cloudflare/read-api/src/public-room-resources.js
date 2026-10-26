// Only existing public z3House gallery URLs are cached: in this isolate and,
// when a database is supplied, in D1 so every isolate shares the result.
// Neither source HTML nor Workspace/identity/financial rows are cached.
const publicCache=new Map(),refreshing=new Map();
const FRESH_MS=21600000,RETRY_MS=60000;

async function fetchGallery(target,helpers,fetcher,now) {
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
  return {status,photos,expires:now+(photos.length?FRESH_MS:RETRY_MS)};
}

function remember(url,entry) {
  if(publicCache.size>=256&&!publicCache.has(url)) publicCache.delete(publicCache.keys().next().value);
  publicCache.set(url,entry);
}

async function readStored(db,urls) {
  const stored=new Map();
  if(!db||!urls.length) return stored;
  try {
    for(let offset=0;offset<urls.length;offset+=80) {
      const chunk=urls.slice(offset,offset+80);
      const result=await db.prepare(`SELECT url,status,photos,expires_at FROM room_gallery_cache WHERE url IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all();
      for(const row of result.results||[]) {
        const photos=JSON.parse(row.photos);
        if(Array.isArray(photos)&&photos.every(photo=>typeof photo==='string')&&Number.isSafeInteger(row.expires_at))
          stored.set(row.url,{status:Number(row.status),photos,expires:row.expires_at});
      }
    }
  } catch {}
  return stored;
}

async function store(db,url,entry) {
  if(!db) return;
  try {
    await db.prepare(`INSERT INTO room_gallery_cache(url,status,photos,expires_at) VALUES (?,?,?,?)
      ON CONFLICT(url) DO UPDATE SET status=excluded.status,photos=excluded.photos,expires_at=excluded.expires_at`)
      .bind(url,entry.status,JSON.stringify(entry.photos),entry.expires).run();
  } catch {}
}

export async function loadPublicRoomResources(values,helpers,options={}) {
  const now=options.now??Date.now(),fetcher=options.fetch??fetch,db=options.db,waitUntil=options.waitUntil;
  const targets=new Map(values.map(value=>helpers.landlordRoomWebsiteCoverTarget_(value)).filter(Boolean).map(target=>[target.url,target]));
  const missing=[...targets.values()].filter(target=>!(publicCache.get(target.url)?.expires>now));
  const stored=await readStored(db,missing.map(target=>target.url));
  await Promise.all(missing.map(async target=>{
    const saved=stored.get(target.url);
    if(saved) {
      remember(target.url,saved);
      if(saved.expires>now||refreshing.has(target.url)) return;
      // Serve the stored gallery now and refresh it after the response.
      const refresh=fetchGallery(target,helpers,fetcher,now)
        .then(entry=>{remember(target.url,entry);return store(db,target.url,entry);})
        .finally(()=>refreshing.delete(target.url));
      refreshing.set(target.url,refresh);
      if(waitUntil) waitUntil(refresh); else await refresh;
      return;
    }
    const entry=await fetchGallery(target,helpers,fetcher,now);
    remember(target.url,entry);
    const saving=store(db,target.url,entry);
    if(waitUntil) waitUntil(saving); else await saving;
  }));
  const resources={};
  for(const target of targets.values()) {
    const cached=publicCache.get(target.url);
    resources[target.url]={status:cached.status,body:'<section class="space-detail__media">'+cached.photos.map(url=>'<img src="'+url+'">').join('')+'</section>'};
  }
  return resources;
}

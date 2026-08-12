const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const validId=value=>typeof value==='string'&&/^[a-f0-9-]{20,64}$/i.test(value);
async function snapshot(db){
  const cutoff=Math.floor(Date.now()/1000)-120;
  const [active,users,metrics]=await Promise.all([
    db.prepare('SELECT COUNT(DISTINCT visitor_id) AS value FROM sessions WHERE last_seen >= ?').bind(cutoff).first(),
    db.prepare('SELECT COUNT(*) AS value FROM visitors').first(),
    db.prepare("SELECT key,value FROM metrics WHERE key IN ('total_visits','bulk_runs','links_processed')").all()
  ]);
  const m=Object.fromEntries((metrics.results||[]).map(row=>[row.key,Number(row.value)]));
  return {activeUsers:Number(active?.value||0),totalUsers:Number(users?.value||0),totalVisits:m.total_visits||0,bulkRuns:m.bulk_runs||0,linksProcessed:m.links_processed||0,updatedAt:new Date().toISOString()};
}
export async function onRequestGet({env}){if(!env.DB)return json({error:'D1 binding DB belum dikonfigurasi'},503);return json(await snapshot(env.DB));}
export async function onRequestPost({request,env}){
  if(!env.DB)return json({error:'D1 binding DB belum dikonfigurasi'},503);
  let body;try{body=await request.json()}catch{return json({error:'JSON tidak valid'},400)}
  const {event='heartbeat',visitorId,sessionId}=body;
  if(!validId(visitorId)||!validId(sessionId))return json({error:'ID sesi tidak valid'},400);
  if(!['visit','heartbeat','bulk'].includes(event))return json({error:'Event tidak didukung'},400);
  const now=Math.floor(Date.now()/1000);
  await env.DB.prepare('INSERT INTO visitors(id,first_seen,last_seen) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen').bind(visitorId,now,now).run();
  const existing=await env.DB.prepare('SELECT id FROM sessions WHERE id=?').bind(sessionId).first();
  await env.DB.prepare('INSERT INTO sessions(id,visitor_id,created_at,last_seen) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen').bind(sessionId,visitorId,now,now).run();
  if(event==='visit'&&!existing)await env.DB.prepare("INSERT INTO metrics(key,value) VALUES('total_visits',1) ON CONFLICT(key) DO UPDATE SET value=value+1").run();
  if(event==='bulk'){
    const count=Math.max(0,Math.min(1000,Math.floor(Number(body.count)||0)));
    await env.DB.batch([
      env.DB.prepare("INSERT INTO metrics(key,value) VALUES('bulk_runs',1) ON CONFLICT(key) DO UPDATE SET value=value+1"),
      env.DB.prepare("INSERT INTO metrics(key,value) VALUES('links_processed',?) ON CONFLICT(key) DO UPDATE SET value=value+excluded.value").bind(count)
    ]);
  }
  if(Math.random()<0.02)await env.DB.prepare('DELETE FROM sessions WHERE last_seen < ?').bind(now-86400).run();
  return json(await snapshot(env.DB));
}
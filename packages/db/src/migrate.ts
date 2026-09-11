import{readFile,readdir}from"node:fs/promises";import{resolve}from"node:path";import{fileURLToPath}from"node:url";import{dbPool,closeDb}from"./pool.js";
const here=fileURLToPath(new URL(".",import.meta.url)),dir=resolve(here,"../../../infra/migrations"),db=dbPool();
await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())`);
for(const name of(await readdir(dir)).filter(n=>n.endsWith(".sql")).sort()){if((await db.query("SELECT 1 FROM schema_migrations WHERE name=$1",[name])).rowCount)continue;const sql=await readFile(resolve(dir,name),"utf8"),c=await db.connect();try{await c.query("BEGIN");await c.query(sql);await c.query("INSERT INTO schema_migrations(name)VALUES($1)",[name]);await c.query("COMMIT");console.log(`applied ${name}`)}catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}}
await closeDb();

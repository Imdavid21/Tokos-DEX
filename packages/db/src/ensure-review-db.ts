import pg from"pg";
const admin=process.env.ADMIN_DATABASE_URL,target=process.env.TOKOS_DATA_DB_NAME??"tokos_data";
if(!admin)throw new Error("ADMIN_DATABASE_URL is required");
if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(target))throw new Error("Invalid database name");
const pool=new pg.Pool({connectionString:admin,max:1});
try{const exists=await pool.query("SELECT 1 FROM pg_database WHERE datname=$1",[target]);if(!exists.rowCount){await pool.query(`CREATE DATABASE "${target}"`);console.log(`created database ${target}`)}else console.log(`database ${target} already exists`)}finally{await pool.end()}

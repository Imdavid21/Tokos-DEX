import pg from"pg";const{Pool}=pg;let singleton:pg.Pool|null=null;
export function dbPool(connectionString=process.env.DATABASE_URL){if(!connectionString)throw new Error("DATABASE_URL is required");if(!singleton)singleton=new Pool({connectionString,max:20,statement_timeout:15000,application_name:"tokos-data",ssl:["production","staging"].includes(process.env.APP_ENV??"")?{rejectUnauthorized:false}:undefined});return singleton;}
export async function closeDb(){if(singleton){await singleton.end();singleton=null;}}

import{loadServerEnv}from"@tokos-data/config";import{closeDb}from"@tokos-data/db";import{materializeRatings}from"./ratings.js";
const env=loadServerEnv();const limit=process.argv[2]?Number(process.argv[2]):undefined;
const result=await materializeRatings(env,limit?{limit}:{});console.log(JSON.stringify({level:"info",job:"indenture-ratings",event:"completed",result}));await closeDb();

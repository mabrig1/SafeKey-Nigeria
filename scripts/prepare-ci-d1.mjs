import fs from "node:fs";

// CI-only local D1 fixture: generated in the runner and intentionally ignored.
// No real Cloudflare account or production database is used.
const config={
  name:"safekey-ci-local",
  main:"src/worker.js",
  compatibility_date:"2025-12-01",
  assets:{directory:"./public",binding:"ASSETS",run_worker_first:true},
  d1_databases:[{
    binding:"DB",
    database_name:"safekey-ci-test",
    database_id:"11111111-1111-4111-8111-111111111111",
    migrations_dir:"migrations"
  }]
};
fs.writeFileSync(".wrangler.test.jsonc",JSON.stringify(config,null,2)+"\n");
fs.writeFileSync(".dev.vars",[
  "HASH_PEPPER="+"a".repeat(48),
  "ADMIN_API_KEY="+"b".repeat(48),
  "REPORTS_ENABLED=true",
  "AI_EXPLANATION_ENABLED=false",
  "EMAIL_ALERTS_ENABLED=false",
  "VERIFICATION_DESK_ENABLED=true",
  ""
].join("\n"),{mode:0o600});
console.log("Created synthetic LOCAL D1 fixture. No credentials or production databases used.");

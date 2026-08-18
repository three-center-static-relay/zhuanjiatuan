#!/usr/bin/env node
import {spawnSync} from "node:child_process";
import {mkdirSync,writeFileSync,rmSync} from "node:fs";
import {dirname,resolve} from "node:path";

const EXPECTED_BRANCH="agent/route-ai-gateway-20260818";
const EXPECTED_MESSAGE="chore(expert): run maintenance small-flow rescue now";
const SOURCE_COMMIT="a454dbb2c013a5197d77f2af1987ff20ba8d9698";
const SOURCE_BASE=`https://raw.githubusercontent.com/three-center-static-relay/zhilizhongxin/${SOURCE_COMMIT}/maintenance`;
const WORKDIR=resolve(".maintenance-smallflow-rescue");
const FILES=[
  "src/index.js",
  "src/expert-route-manager.js",
  "scripts/run-immediate-refresh.mjs",
  "wrangler.jsonc"
];

function fail(code,details={}){
  console.error(JSON.stringify({ok:false,code,...details}));
  process.exit(1);
}
function git(args){
  const r=spawnSync("git",args,{encoding:"utf8",env:process.env});
  if(r.error||r.status!==0)fail("GIT_CONTEXT_UNAVAILABLE",{args,status:r.status??null});
  return String(r.stdout||"").trim();
}
function gate(){
  if(process.env.WORKERS_CI!=="1")fail("WORKERS_CI_REQUIRED");
  if(process.env.WORKERS_CI_BRANCH!==EXPECTED_BRANCH)fail("RESCUE_BRANCH_MISMATCH",{branch:process.env.WORKERS_CI_BRANCH||null});
  const message=git(["log","-1","--pretty=%s"]);
  if(message!==EXPECTED_MESSAGE){
    console.log(JSON.stringify({ok:true,skipped:true,code:"MAINTENANCE_RESCUE_NOT_REQUESTED",head_message:message}));
    process.exit(0);
  }
  const head=git(["rev-parse","HEAD"]);
  if(process.env.WORKERS_CI_COMMIT_SHA&&head!==process.env.WORKERS_CI_COMMIT_SHA)fail("HEAD_COMMIT_MISMATCH",{head,ci_sha:process.env.WORKERS_CI_COMMIT_SHA});
  return head;
}
async function download(path){
  const response=await fetch(`${SOURCE_BASE}/${path}`,{headers:{accept:"text/plain"}});
  if(!response.ok)fail("RESCUE_SOURCE_DOWNLOAD_FAILED",{path,http_status:response.status});
  const text=await response.text();
  if(!text.trim())fail("RESCUE_SOURCE_EMPTY",{path});
  const target=resolve(WORKDIR,path);
  mkdirSync(dirname(target),{recursive:true});
  writeFileSync(target,text);
  return text.length;
}

const head=gate();
rmSync(WORKDIR,{recursive:true,force:true});
mkdirSync(WORKDIR,{recursive:true});
try{
  console.log(JSON.stringify({event:"MAINTENANCE_SMALLFLOW_RESCUE_BEGIN",head,source_commit:SOURCE_COMMIT}));
  const downloaded={};
  for(const path of FILES)downloaded[path]=await download(path);
  console.log(JSON.stringify({event:"MAINTENANCE_SMALLFLOW_SOURCE_PINNED",source_commit:SOURCE_COMMIT,downloaded}));
  const syntax=spawnSync(process.execPath,["--check",resolve(WORKDIR,"src/expert-route-manager.js")],{stdio:"inherit",env:process.env});
  if(syntax.error||syntax.status!==0)fail("RESCUE_SOURCE_SYNTAX_FAILED",{status:syntax.status??null});
  const run=spawnSync(process.execPath,[resolve(WORKDIR,"scripts/run-immediate-refresh.mjs")],{cwd:WORKDIR,stdio:"inherit",env:process.env});
  if(run.error||run.status!==0)fail("MAINTENANCE_SMALLFLOW_RESCUE_FAILED",{status:run.status??null,error:run.error?.message||null});
  console.log(JSON.stringify({ok:true,code:"MAINTENANCE_SMALLFLOW_RESCUE_COMPLETED",head,source_commit:SOURCE_COMMIT,secrets_redacted:true}));
}finally{
  rmSync(WORKDIR,{recursive:true,force:true});
}
